import type { Context, Hono } from "hono";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson } from "../http/validation.js";
import { auditChange, requireAccess, type AccessActor, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { routePermissionCatalog, type PermissionCode } from "./permissions.js";

type Queryable = Pool | PoolClient;

export type CategorySpecType = "text" | "number" | "boolean" | "select";

export interface CategorySpecOption {
  id: string;
  definitionId: string;
  value: string;
  label: string;
  sortOrder: number;
  status: "active" | "inactive";
}

export interface CategorySpecDefinition {
  id: string;
  warehouseId: string;
  categoryId: string;
  code: string;
  name: string;
  type: CategorySpecType;
  required: boolean;
  unit: string | null;
  minValue: string | null;
  maxValue: string | null;
  sortOrder: number;
  status: "active" | "inactive";
  options: CategorySpecOption[];
}

export interface CategorySpecDefinitionCreateInput extends Omit<CategorySpecDefinition, "id" | "status" | "options"> {
  options: Array<Pick<CategorySpecOption, "value" | "label" | "sortOrder">>;
}

export interface CategorySpecDefinitionUpdateInput extends Pick<CategorySpecDefinition, "name" | "required" | "unit" | "minValue" | "maxValue" | "sortOrder"> {}

export interface CategorySpecOptionCreateInput extends Pick<CategorySpecOption, "value" | "label" | "sortOrder"> {}

export interface CategorySpecOptionUpdateInput extends Pick<CategorySpecOption, "label" | "sortOrder"> {}

export interface ProductSpecValueInput {
  definitionId: string;
  textValue?: string;
  numberValue?: number;
  booleanValue?: boolean;
  optionValue?: string;
}

export interface ProductSpecValue {
  definitionId: string;
  code: string;
  name: string;
  type: CategorySpecType;
  required: boolean;
  unit: string | null;
  sortOrder: number;
  status: "active" | "inactive";
  value: string | number | boolean;
  optionLabel: string | null;
}

type PersistedProductSpecValue = {
  definitionId: string;
  textValue: string | null;
  numberValue: string | null;
  booleanValue: boolean | null;
  optionValue: string | null;
};

export interface CatalogSpecStore {
  listDefinitions(warehouseId: string, categoryId: string): Promise<CategorySpecDefinition[] | null>;
  createDefinition(input: CategorySpecDefinitionCreateInput): Promise<CategorySpecDefinition | null>;
  updateDefinition(warehouseId: string, definitionId: string, input: CategorySpecDefinitionUpdateInput): Promise<CategorySpecDefinition | null>;
  setDefinitionStatus(
    warehouseId: string,
    definitionId: string,
    status: CategorySpecDefinition["status"],
  ): Promise<CategorySpecDefinition | null>;
  createOption(warehouseId: string, definitionId: string, input: CategorySpecOptionCreateInput): Promise<CategorySpecOption | null>;
  updateOption(warehouseId: string, optionId: string, input: CategorySpecOptionUpdateInput): Promise<CategorySpecOption | null>;
  setOptionStatus(
    warehouseId: string,
    optionId: string,
    status: CategorySpecOption["status"],
  ): Promise<CategorySpecOption | null>;
}

const optionValueSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/);
const optionCreateSchema = z.object({
  value: optionValueSchema,
  label: z.string().trim().min(1).max(120),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
}).strict();
const optionUpdateSchema = z.object({
  label: z.string().trim().min(1).max(120),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
}).strict();
const specStatusSchema = z.object({ status: z.enum(["active", "inactive"]) }).strict();

const definitionCreateSchema = z.object({
  code: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["text", "number", "boolean", "select"]),
  required: z.boolean().default(false),
  unit: z.string().trim().min(1).max(30).optional(),
  minValue: z.coerce.number().finite().optional(),
  maxValue: z.coerce.number().finite().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  options: z.array(optionCreateSchema).max(50).default([]),
}).strict().superRefine((value, context) => {
  if (value.type === "select" && value.options.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Thông số chọn phải có ít nhất một lựa chọn" });
  }
  if (value.type !== "select" && value.options.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Chỉ thông số chọn mới có lựa chọn" });
  }
  if (value.type !== "number" && (value.unit !== undefined || value.minValue !== undefined || value.maxValue !== undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["type"], message: "Chỉ thông số số mới có đơn vị hoặc min/max" });
  }
  if (value.minValue !== undefined && value.maxValue !== undefined && value.minValue > value.maxValue) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["minValue"], message: "Giá trị nhỏ nhất không được lớn hơn giá trị lớn nhất" });
  }
  if (new Set(value.options.map((option) => option.value)).size !== value.options.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["options"], message: "Giá trị lựa chọn không được trùng" });
  }
});

const definitionUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  required: z.boolean().default(false),
  unit: z.string().trim().min(1).max(30).nullable().optional(),
  minValue: z.union([z.null(), z.coerce.number().finite()]).optional(),
  maxValue: z.union([z.null(), z.coerce.number().finite()]).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
}).strict().superRefine((value, context) => {
  if (value.minValue !== null && value.maxValue !== null && value.minValue !== undefined && value.maxValue !== undefined && value.minValue > value.maxValue) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["minValue"], message: "Giá trị nhỏ nhất không được lớn hơn giá trị lớn nhất" });
  }
});

const specValueInputSchema = z.object({
  definitionId: z.string().min(1),
  textValue: z.string().optional(),
  numberValue: z.number().finite().optional(),
  booleanValue: z.boolean().optional(),
  optionValue: z.string().min(1).optional(),
}).strict();

function routeId(context: Context, key = "id") {
  const result = z.string().uuid().safeParse(context.req.param(key));
  if (!result.success) throw new HttpError(422, "VALIDATION_ERROR", "ID không hợp lệ");
  return result.data;
}

async function warehouseFor(context: Context, actor: AccessActor, resolver: () => Promise<string | null>) {
  if (actor.user.kind !== "master_admin") {
    if (!actor.user.warehouseId) throw new HttpError(403, "FORBIDDEN", "Không có kho");
    return actor.user.warehouseId;
  }
  const requested = context.req.query("warehouseId");
  if (!requested) {
    const defaultWarehouseId = await resolver();
    if (defaultWarehouseId) return defaultWarehouseId;
  }
  const result = z.string().uuid().safeParse(requested);
  if (!result.success) throw new HttpError(422, "VALIDATION_ERROR", "Master phải chọn warehouseId hợp lệ");
  return result.data;
}

function conflict(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    throw new HttpError(409, "DUPLICATE", "Mã hoặc giá trị đã tồn tại");
  }
  throw error;
}

function normalizeSpecMutationError(error: unknown): never {
  if (error instanceof HttpError) throw error;
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "INVALID_CATEGORY_SCOPE") throw new HttpError(404, "NOT_FOUND", "Không tìm thấy danh mục");
    if (error.code === "INVALID_DEFINITION_SCOPE") throw new HttpError(404, "NOT_FOUND", "Không tìm thấy thông số");
    if (error.code === "INVALID_OPTION_SCOPE") throw new HttpError(404, "NOT_FOUND", "Không tìm thấy lựa chọn");
    if (error.code === "INVALID_DEFINITION_TYPE") throw new HttpError(422, "INVALID_DEFINITION_TYPE", "Loại thông số không hỗ trợ thao tác này");
  }
  conflict(error);
}

type DefinitionRow = Omit<CategorySpecDefinition, "options">;

async function loadDefinitionsByCategory(
  executor: Queryable,
  warehouseId: string,
  categoryId: string,
  includeInactive = false,
) {
  const definitions = await executor.query<DefinitionRow>(
    `SELECT id,
        warehouse_id AS "warehouseId",
        category_id AS "categoryId",
        code,
        name,
        type,
        required,
        unit,
        min_value::text AS "minValue",
        max_value::text AS "maxValue",
        sort_order AS "sortOrder",
        status
     FROM category_spec_definitions
     WHERE warehouse_id = $1
       AND category_id = $2
       AND ($3::boolean OR status = 'active')
     ORDER BY sort_order ASC, created_at ASC`,
    [warehouseId, categoryId, includeInactive],
  );

  if (definitions.rows.length === 0) return [] as CategorySpecDefinition[];

  const options = await executor.query<CategorySpecOption>(
    `SELECT id,
        definition_id AS "definitionId",
        value,
        label,
        sort_order AS "sortOrder",
        status
     FROM category_spec_options
     WHERE definition_id = ANY($1::uuid[])
       AND ($2::boolean OR status = 'active')
     ORDER BY sort_order ASC, created_at ASC`,
    [definitions.rows.map((definition) => definition.id), includeInactive],
  );

  const optionMap = new Map<string, CategorySpecOption[]>();
  for (const option of options.rows) {
    const list = optionMap.get(option.definitionId) ?? [];
    list.push(option);
    optionMap.set(option.definitionId, list);
  }

  return definitions.rows.map((definition) => ({
    ...definition,
    options: optionMap.get(definition.id) ?? [],
  }));
}

async function definitionWarehouseForCategory(executor: Queryable, warehouseId: string, categoryId: string) {
  const result = await executor.query<{ exists: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM categories WHERE id = $1 AND warehouse_id = $2) AS exists`,
    [categoryId, warehouseId],
  );
  return result.rows[0]?.exists ?? false;
}

export async function validateProductSpecValues(
  executor: Queryable,
  warehouseId: string,
  categoryId: string | null,
  input: ProductSpecValueInput[],
) {
  if (!categoryId) {
    if (input.length > 0) {
      throw new HttpError(422, "INVALID_SPEC_CATEGORY", "Sản phẩm chưa có danh mục nên không thể lưu thuộc tính");
    }
    return { definitions: [] as CategorySpecDefinition[], values: [] as PersistedProductSpecValue[] };
  }

  const definitions = await loadDefinitionsByCategory(executor, warehouseId, categoryId, false);
  const definitionMap = new Map(definitions.map((definition) => [definition.id, definition]));
  const normalized: PersistedProductSpecValue[] = [];
  const seen = new Set<string>();

  for (const raw of input) {
    const item = specValueInputSchema.parse(raw);
    if (seen.has(item.definitionId)) {
      throw new HttpError(422, "VALIDATION_ERROR", "Thông số không được trùng lặp");
    }
    seen.add(item.definitionId);

    const definition = definitionMap.get(item.definitionId);
    if (!definition) {
      throw new HttpError(422, "INVALID_SPEC_DEFINITION", "Thuộc tính không thuộc danh mục sản phẩm");
    }

    const valueCount = [item.textValue, item.numberValue, item.booleanValue, item.optionValue]
      .filter((value) => value !== undefined && value !== null).length;
    if (valueCount !== 1) {
      throw new HttpError(422, "VALIDATION_ERROR", "Mỗi thuộc tính chỉ được nhập một giá trị hợp lệ");
    }

    if (definition.type === "text") {
      const value = item.textValue?.trim();
      if (!value) throw new HttpError(422, "VALIDATION_ERROR", `Thuộc tính ${definition.name} phải là chuỗi hợp lệ`);
      normalized.push({ definitionId: definition.id, textValue: value, numberValue: null, booleanValue: null, optionValue: null });
      continue;
    }

    if (definition.type === "number") {
      if (typeof item.numberValue !== "number" || !Number.isFinite(item.numberValue)) {
        throw new HttpError(422, "VALIDATION_ERROR", `Thuộc tính ${definition.name} phải là số hợp lệ`);
      }
      const minValue = definition.minValue === null ? null : Number(definition.minValue);
      const maxValue = definition.maxValue === null ? null : Number(definition.maxValue);
      if (minValue !== null && item.numberValue < minValue) {
        throw new HttpError(422, "VALIDATION_ERROR", `Thuộc tính ${definition.name} nhỏ hơn giá trị tối thiểu`);
      }
      if (maxValue !== null && item.numberValue > maxValue) {
        throw new HttpError(422, "VALIDATION_ERROR", `Thuộc tính ${definition.name} lớn hơn giá trị tối đa`);
      }
      normalized.push({ definitionId: definition.id, textValue: null, numberValue: String(item.numberValue), booleanValue: null, optionValue: null });
      continue;
    }

    if (definition.type === "boolean") {
      if (typeof item.booleanValue !== "boolean") {
        throw new HttpError(422, "VALIDATION_ERROR", `Thuộc tính ${definition.name} phải là true/false`);
      }
      normalized.push({ definitionId: definition.id, textValue: null, numberValue: null, booleanValue: item.booleanValue, optionValue: null });
      continue;
    }

    const optionValue = item.optionValue?.trim();
    if (!optionValue) {
      throw new HttpError(422, "VALIDATION_ERROR", `Thuộc tính ${definition.name} phải chọn một giá trị`);
    }
    if (!definition.options.some((option) => option.status === "active" && option.value === optionValue)) {
      throw new HttpError(422, "VALIDATION_ERROR", `Giá trị của thuộc tính ${definition.name} không hợp lệ`);
    }
    normalized.push({ definitionId: definition.id, textValue: null, numberValue: null, booleanValue: null, optionValue });
  }

  const missingRequired = definitions.filter((definition) => definition.required && !seen.has(definition.id));
  if (missingRequired.length > 0) {
    throw new HttpError(422, "VALIDATION_ERROR", `Thiếu thuộc tính bắt buộc: ${missingRequired.map((definition) => definition.name).join(", ")}`);
  }

  return { definitions, values: normalized };
}

export async function replaceProductSpecValues(
  executor: Queryable,
  productId: string,
  values: PersistedProductSpecValue[],
) {
  await executor.query(`DELETE FROM product_spec_values WHERE product_id = $1`, [productId]);
  for (const value of values) {
    await executor.query(
      `INSERT INTO product_spec_values
        (product_id, definition_id, text_value, number_value, boolean_value, option_value)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, value.definitionId, value.textValue, value.numberValue, value.booleanValue, value.optionValue],
    );
  }
}

export async function loadProductSpecValuesByProductIds(
  executor: Queryable,
  productIds: string[],
) {
  const valueMap = new Map<string, ProductSpecValue[]>();
  if (productIds.length === 0) return valueMap;

  const result = await executor.query<{
    productId: string;
    definitionId: string;
    code: string;
    name: string;
    type: CategorySpecType;
    required: boolean;
    unit: string | null;
    sortOrder: number;
    status: "active" | "inactive";
    textValue: string | null;
    numberValue: string | null;
    booleanValue: boolean | null;
    optionValue: string | null;
    optionLabel: string | null;
  }>(
    `SELECT pv.product_id AS "productId",
        pv.definition_id AS "definitionId",
        d.code,
        d.name,
        d.type,
        d.required,
        d.unit,
        d.sort_order AS "sortOrder",
        d.status,
        pv.text_value AS "textValue",
        pv.number_value::text AS "numberValue",
        pv.boolean_value AS "booleanValue",
        pv.option_value AS "optionValue",
        o.label AS "optionLabel"
     FROM product_spec_values pv
     JOIN category_spec_definitions d ON d.id = pv.definition_id
     LEFT JOIN category_spec_options o ON o.definition_id = d.id AND o.value = pv.option_value
     WHERE pv.product_id = ANY($1::uuid[])
     ORDER BY d.sort_order ASC, d.created_at ASC`,
    [productIds],
  );

  for (const row of result.rows) {
    const list = valueMap.get(row.productId) ?? [];
    list.push({
      definitionId: row.definitionId,
      code: row.code,
      name: row.name,
      type: row.type,
      required: row.required,
      unit: row.unit,
      sortOrder: row.sortOrder,
      status: row.status,
      value: row.type === "number"
        ? Number(row.numberValue)
        : row.type === "boolean"
          ? Boolean(row.booleanValue)
          : row.type === "select"
            ? row.optionValue ?? ""
            : row.textValue ?? "",
      optionLabel: row.optionLabel ?? row.optionValue,
    });
    valueMap.set(row.productId, list);
  }

  return valueMap;
}

export function registerCatalogSpecRoutes(
  app: Hono,
  authStore: AuthStore,
  accessStore: AccessStore,
  store: CatalogSpecStore & { defaultWarehouseId(): Promise<string | null> },
  sessionSecret: string,
) {
  const actor = (context: Context, permission: PermissionCode) =>
    requireAccess(context, authStore, accessStore, sessionSecret, { permission });

  app.get("/api/catalog/categories/:id/spec-definitions", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/catalog/categories/:id/spec-definitions"]);
    const warehouseId = await warehouseFor(c, current, store.defaultWarehouseId);
    const categoryId = routeId(c);
    const definitions = await store.listDefinitions(warehouseId, categoryId);
    if (!definitions) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy danh mục");
    return c.json({ data: definitions });
  });

  app.post("/api/catalog/categories/:id/spec-definitions", async (c) => {
    const current = await actor(c, routePermissionCatalog["POST /api/catalog/categories/:id/spec-definitions"]);
    const warehouseId = await warehouseFor(c, current, store.defaultWarehouseId);
    const categoryId = routeId(c);
    const input = await parseJson(c, definitionCreateSchema);
    let definition: CategorySpecDefinition | null = null;
    try {
      definition = await store.createDefinition({
        warehouseId,
        categoryId,
        code: input.code,
        name: input.name,
        type: input.type,
        required: input.required ?? false,
        unit: input.unit ?? null,
        minValue: input.minValue === undefined ? null : String(input.minValue),
        maxValue: input.maxValue === undefined ? null : String(input.maxValue),
        sortOrder: input.sortOrder ?? 0,
        options: (input.options ?? []).map((option) => ({
          value: option.value,
          label: option.label,
          sortOrder: option.sortOrder ?? 0,
        })),
      });
    } catch (error) {
      normalizeSpecMutationError(error);
    }
    if (!definition) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy danh mục");
    await auditChange(accessStore, current, {
      warehouseId,
      action: "catalog.spec.definition.create",
      entityType: "category_spec_definition",
      entityId: definition.id,
      metadata: { categoryId },
    });
    return c.json({ definition }, 201);
  });

  app.patch("/api/catalog/spec-definitions/:id", async (c) => {
    const current = await actor(c, routePermissionCatalog["PATCH /api/catalog/spec-definitions/:id"]);
    const warehouseId = await warehouseFor(c, current, store.defaultWarehouseId);
    const definitionId = routeId(c);
    const input = await parseJson(c, definitionUpdateSchema);
    let definition: CategorySpecDefinition | null = null;
    try {
      definition = await store.updateDefinition(warehouseId, definitionId, {
        name: input.name,
        required: input.required ?? false,
        unit: input.unit ?? null,
        minValue: input.minValue === undefined ? null : input.minValue === null ? null : String(input.minValue),
        maxValue: input.maxValue === undefined ? null : input.maxValue === null ? null : String(input.maxValue),
        sortOrder: input.sortOrder ?? 0,
      });
    } catch (error) {
      normalizeSpecMutationError(error);
    }
    if (!definition) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy thông số");
    await auditChange(accessStore, current, {
      warehouseId,
      action: "catalog.spec.definition.update",
      entityType: "category_spec_definition",
      entityId: definition.id,
    });
    return c.json({ definition });
  });

  app.patch("/api/catalog/spec-definitions/:id/status", async (c) => {
    const current = await actor(c, routePermissionCatalog["PATCH /api/catalog/spec-definitions/:id/status"]);
    const warehouseId = await warehouseFor(c, current, store.defaultWarehouseId);
    const definitionId = routeId(c);
    const { status } = await parseJson(c, specStatusSchema);
    let definition: CategorySpecDefinition | null = null;
    try {
      definition = await store.setDefinitionStatus(warehouseId, definitionId, status);
    } catch (error) {
      normalizeSpecMutationError(error);
    }
    if (!definition) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy thông số");
    await auditChange(accessStore, current, {
      warehouseId,
      action: "catalog.spec.definition.status",
      entityType: "category_spec_definition",
      entityId: definition.id,
      metadata: { status },
    });
    return c.json({ definition });
  });

  app.post("/api/catalog/spec-definitions/:id/options", async (c) => {
    const current = await actor(c, routePermissionCatalog["POST /api/catalog/spec-definitions/:id/options"]);
    const warehouseId = await warehouseFor(c, current, store.defaultWarehouseId);
    const definitionId = routeId(c);
    const input = await parseJson(c, optionCreateSchema);
    let option: CategorySpecOption | null = null;
    try {
      option = await store.createOption(warehouseId, definitionId, {
        value: input.value,
        label: input.label,
        sortOrder: input.sortOrder ?? 0,
      });
    } catch (error) {
      normalizeSpecMutationError(error);
    }
    if (!option) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy thông số");
    await auditChange(accessStore, current, {
      warehouseId,
      action: "catalog.spec.option.create",
      entityType: "category_spec_option",
      entityId: option.id,
      metadata: { definitionId },
    });
    return c.json({ option }, 201);
  });

  app.patch("/api/catalog/spec-options/:id", async (c) => {
    const current = await actor(c, routePermissionCatalog["PATCH /api/catalog/spec-options/:id"]);
    const warehouseId = await warehouseFor(c, current, store.defaultWarehouseId);
    const optionId = routeId(c);
    const input = await parseJson(c, optionUpdateSchema);
    let option: CategorySpecOption | null = null;
    try {
      option = await store.updateOption(warehouseId, optionId, {
        label: input.label,
        sortOrder: input.sortOrder ?? 0,
      });
    } catch (error) {
      normalizeSpecMutationError(error);
    }
    if (!option) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy lựa chọn");
    await auditChange(accessStore, current, {
      warehouseId,
      action: "catalog.spec.option.update",
      entityType: "category_spec_option",
      entityId: option.id,
    });
    return c.json({ option });
  });

  app.patch("/api/catalog/spec-options/:id/status", async (c) => {
    const current = await actor(c, routePermissionCatalog["PATCH /api/catalog/spec-options/:id/status"]);
    const warehouseId = await warehouseFor(c, current, store.defaultWarehouseId);
    const optionId = routeId(c);
    const { status } = await parseJson(c, specStatusSchema);
    let option: CategorySpecOption | null = null;
    try {
      option = await store.setOptionStatus(warehouseId, optionId, status);
    } catch (error) {
      normalizeSpecMutationError(error);
    }
    if (!option) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy lựa chọn");
    await auditChange(accessStore, current, {
      warehouseId,
      action: "catalog.spec.option.status",
      entityType: "category_spec_option",
      entityId: option.id,
      metadata: { status },
    });
    return c.json({ option });
  });
}

export function createPostgresCatalogSpecStore(pool: Pool): CatalogSpecStore & { defaultWarehouseId(): Promise<string | null> } {
  async function definitionById(executor: Queryable, warehouseId: string, definitionId: string) {
    const row = await executor.query<{ categoryId: string }>(
      `SELECT category_id AS "categoryId"
       FROM category_spec_definitions
       WHERE id = $1 AND warehouse_id = $2`,
      [definitionId, warehouseId],
    );
    const categoryId = row.rows[0]?.categoryId;
    return categoryId ? loadDefinitionsByCategory(executor, warehouseId, categoryId, true) : null;
  }

  async function optionById(executor: Queryable, warehouseId: string, optionId: string) {
    const row = await executor.query<CategorySpecOption>(
      `SELECT o.id,
          o.definition_id AS "definitionId",
          o.value,
          o.label,
          o.sort_order AS "sortOrder",
          o.status
       FROM category_spec_options o
       JOIN category_spec_definitions d ON d.id = o.definition_id
       WHERE o.id = $1 AND d.warehouse_id = $2`,
      [optionId, warehouseId],
    );
    return row.rows[0] ?? null;
  }

  return {
    async defaultWarehouseId() {
      const result = await pool.query<{ id: string }>(`SELECT id FROM warehouses ORDER BY code LIMIT 2`);
      return result.rows.length === 1 ? result.rows[0]!.id : null;
    },
    async listDefinitions(warehouseId: string, categoryId: string) {
      if (!await definitionWarehouseForCategory(pool, warehouseId, categoryId)) return null;
      return loadDefinitionsByCategory(pool, warehouseId, categoryId, true);
    },
    async createDefinition(input: CategorySpecDefinitionCreateInput) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (!await definitionWarehouseForCategory(client, input.warehouseId, input.categoryId)) {
          throw Object.assign(new Error("invalid category scope"), { code: "INVALID_CATEGORY_SCOPE" });
        }
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO category_spec_definitions
            (warehouse_id, category_id, code, name, type, required, unit, min_value, max_value, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [input.warehouseId, input.categoryId, input.code, input.name, input.type, input.required, input.unit, input.minValue, input.maxValue, input.sortOrder],
        );
        const definitionId = inserted.rows[0]?.id;
        if (!definitionId) throw new Error("Spec definition insert returned no row");
        if (input.options.length > 0) {
          for (const option of input.options) {
            await client.query(
              `INSERT INTO category_spec_options
                (definition_id, value, label, sort_order)
               VALUES ($1, $2, $3, $4)`,
              [definitionId, option.value, option.label, option.sortOrder],
            );
          }
        }
        await client.query("COMMIT");
        const definitions = await loadDefinitionsByCategory(pool, input.warehouseId, input.categoryId, true);
        return definitions.find((definition) => definition.id === definitionId) ?? null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async updateDefinition(
      warehouseId: string,
      definitionId: string,
      input: CategorySpecDefinitionUpdateInput,
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const current = await client.query<Pick<CategorySpecDefinition, "id" | "categoryId" | "type">>(
          `SELECT id, category_id AS "categoryId", type
           FROM category_spec_definitions
           WHERE id = $1 AND warehouse_id = $2
           FOR UPDATE`,
          [definitionId, warehouseId],
        );
        const definition = current.rows[0];
        if (!definition) {
          await client.query("ROLLBACK");
          return null;
        }
        if (definition.type !== "number" && (input.unit !== null || input.minValue !== null || input.maxValue !== null)) {
          throw Object.assign(new Error("invalid definition type"), { code: "INVALID_DEFINITION_TYPE" });
        }
        await client.query(
          `UPDATE category_spec_definitions
           SET name = $3,
               required = $4,
               unit = $5,
               min_value = $6,
               max_value = $7,
               sort_order = $8,
               updated_at = now()
           WHERE id = $1 AND warehouse_id = $2`,
          [definitionId, warehouseId, input.name, input.required, input.unit, input.minValue, input.maxValue, input.sortOrder],
        );
        await client.query("COMMIT");
        const definitions = await loadDefinitionsByCategory(pool, warehouseId, definition.categoryId, true);
        return definitions.find((item) => item.id === definitionId) ?? null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async setDefinitionStatus(
      warehouseId: string,
      definitionId: string,
      status: CategorySpecDefinition["status"],
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const current = await client.query<{ categoryId: string }>(
          `SELECT category_id AS "categoryId"
           FROM category_spec_definitions
           WHERE id = $1 AND warehouse_id = $2
           FOR UPDATE`,
          [definitionId, warehouseId],
        );
        const definition = current.rows[0];
        if (!definition) {
          await client.query("ROLLBACK");
          return null;
        }
        await client.query(
          `UPDATE category_spec_definitions
           SET status = $3, updated_at = now()
           WHERE id = $1 AND warehouse_id = $2`,
          [definitionId, warehouseId, status],
        );
        await client.query("COMMIT");
        const definitions = await loadDefinitionsByCategory(pool, warehouseId, definition.categoryId, true);
        return definitions.find((item) => item.id === definitionId) ?? null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async createOption(
      warehouseId: string,
      definitionId: string,
      input: CategorySpecOptionCreateInput,
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const definition = await client.query<{ type: CategorySpecType }>(
          `SELECT type
           FROM category_spec_definitions
           WHERE id = $1 AND warehouse_id = $2
           FOR UPDATE`,
          [definitionId, warehouseId],
        );
        const current = definition.rows[0];
        if (!current) {
          await client.query("ROLLBACK");
          return null;
        }
        if (current.type !== "select") {
          throw Object.assign(new Error("invalid definition type"), { code: "INVALID_DEFINITION_TYPE" });
        }
        const inserted = await client.query<CategorySpecOption>(
          `INSERT INTO category_spec_options
            (definition_id, value, label, sort_order)
           VALUES ($1, $2, $3, $4)
           RETURNING id,
             definition_id AS "definitionId",
             value,
             label,
             sort_order AS "sortOrder",
             status`,
          [definitionId, input.value, input.label, input.sortOrder],
        );
        await client.query("COMMIT");
        return inserted.rows[0] ?? null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async updateOption(
      warehouseId: string,
      optionId: string,
      input: CategorySpecOptionUpdateInput,
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existing = await optionById(client, warehouseId, optionId);
        if (!existing) {
          await client.query("ROLLBACK");
          return null;
        }
        await client.query(
          `UPDATE category_spec_options
           SET label = $2, sort_order = $3, updated_at = now()
           WHERE id = $1`,
          [optionId, input.label, input.sortOrder],
        );
        await client.query("COMMIT");
        return optionById(pool, warehouseId, optionId);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async setOptionStatus(
      warehouseId: string,
      optionId: string,
      status: CategorySpecOption["status"],
    ) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existing = await optionById(client, warehouseId, optionId);
        if (!existing) {
          await client.query("ROLLBACK");
          return null;
        }
        await client.query(
          `UPDATE category_spec_options
           SET status = $2, updated_at = now()
           WHERE id = $1`,
          [optionId, status],
        );
        await client.query("COMMIT");
        return optionById(pool, warehouseId, optionId);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
