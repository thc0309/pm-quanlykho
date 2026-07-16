import type { Context, Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import { auditChange, requireAccess, type AccessActor, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { routePermissionCatalog, type PermissionCode } from "./permissions.js";

type Page<T> = { data: T[]; total: number };

export interface CatalogCategory {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  status: "active" | "inactive";
}

export interface CatalogUnit {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  baseUnitId: string | null;
  conversionFactor: string;
  status: "active" | "inactive";
}

export interface CatalogStore {
  defaultWarehouseId(): Promise<string | null>;
  listCategories(warehouseId: string | null, limit: number, offset: number): Promise<Page<CatalogCategory>>;
  createCategory(input: Omit<CatalogCategory, "id" | "status">): Promise<CatalogCategory>;
  listUnits(warehouseId: string | null, limit: number, offset: number): Promise<Page<CatalogUnit>>;
  findUnit(warehouseId: string, id: string): Promise<CatalogUnit | null>;
  createUnit(input: Omit<CatalogUnit, "id" | "status">): Promise<CatalogUnit>;
}

const categorySchema = z.object({
  code: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
}).strict();

const unitSchema = z.object({
  code: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  baseUnitId: z.string().uuid().optional(),
  conversionFactor: z.coerce.number().positive().optional(),
}).strict().superRefine((value, context) => {
  if (Boolean(value.baseUnitId) !== (value.conversionFactor !== undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Conversion must include both baseUnitId and conversionFactor",
      path: ["conversionFactor"],
    });
  }
});

async function warehouseFor(context: Context, actor: AccessActor, store: CatalogStore) {
  if (actor.user.kind !== "master_admin") {
    if (!actor.user.warehouseId) throw new HttpError(403, "FORBIDDEN", "Không có kho");
    return actor.user.warehouseId;
  }
  const requested = context.req.query("warehouseId");
  if (!requested) {
    const defaultWarehouseId = await store.defaultWarehouseId();
    if (defaultWarehouseId) return defaultWarehouseId;
  }
  const result = z.string().uuid().safeParse(requested);
  if (!result.success) throw new HttpError(422, "VALIDATION_ERROR", "Master phải chọn warehouseId hợp lệ");
  return result.data;
}

function warehouseScopeFor(context: Context, actor: AccessActor) {
  if (actor.user.kind !== "master_admin") {
    if (!actor.user.warehouseId) throw new HttpError(403, "FORBIDDEN", "Không có kho");
    return actor.user.warehouseId;
  }
  const requested = context.req.query("warehouseId");
  if (!requested) return null;
  const result = z.string().uuid().safeParse(requested);
  if (!result.success) throw new HttpError(422, "VALIDATION_ERROR", "warehouseId không hợp lệ");
  return result.data;
}

function conflict(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    throw new HttpError(409, "DUPLICATE", "Mã đã tồn tại");
  }
  throw error;
}

function pageResponse<T>(data: Page<T>, page: number, pageSize: number) {
  return {
    data: data.data,
    pagination: {
      page,
      pageSize,
      totalItems: data.total,
      totalPages: Math.ceil(data.total / pageSize),
    },
  };
}

export function registerCatalogRoutes(
  app: Hono,
  authStore: AuthStore,
  accessStore: AccessStore,
  store: CatalogStore,
  sessionSecret: string,
) {
  const actor = (context: Context, permission: PermissionCode) =>
    requireAccess(context, authStore, accessStore, sessionSecret, { permission });

  app.get("/api/catalog/categories", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/catalog/categories"]);
    const pagination = parsePagination(c.req.query());
    const result = await store.listCategories(warehouseScopeFor(c, current), pagination.pageSize, pagination.offset);
    return c.json(pageResponse(result, pagination.page, pagination.pageSize));
  });

  app.post("/api/catalog/categories", async (c) => {
    const current = await actor(c, routePermissionCatalog["POST /api/catalog/categories"]);
    const warehouseId = await warehouseFor(c, current, store);
    const input = await parseJson(c, categorySchema);
    let category: CatalogCategory;
    try {
      category = await store.createCategory({ ...input, warehouseId });
    } catch (error) {
      conflict(error);
    }
    await auditChange(accessStore, current, { warehouseId, action: "catalog.category.create", entityType: "category", entityId: category!.id });
    return c.json({ category: category! }, 201);
  });

  app.get("/api/catalog/units", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/catalog/units"]);
    const pagination = parsePagination(c.req.query());
    const result = await store.listUnits(warehouseScopeFor(c, current), pagination.pageSize, pagination.offset);
    return c.json(pageResponse(result, pagination.page, pagination.pageSize));
  });

  app.post("/api/catalog/units", async (c) => {
    const current = await actor(c, routePermissionCatalog["POST /api/catalog/units"]);
    const warehouseId = await warehouseFor(c, current, store);
    const input = await parseJson(c, unitSchema);
    const baseUnitId = input.baseUnitId ?? null;
    if (baseUnitId) {
      const baseUnit = await store.findUnit(warehouseId, baseUnitId);
      if (!baseUnit) throw new HttpError(422, "INVALID_BASE_UNIT", "Đơn vị gốc không hợp lệ");
      if (baseUnit.baseUnitId) throw new HttpError(422, "AMBIGUOUS_CONVERSION", "Chỉ cho phép quy đổi từ đơn vị gốc");
    }

    let unit: CatalogUnit;
    try {
      unit = await store.createUnit({
        code: input.code,
        name: input.name,
        warehouseId,
        baseUnitId,
        conversionFactor: String(input.conversionFactor ?? 1),
      });
    } catch (error) {
      conflict(error);
    }
    await auditChange(accessStore, current, { warehouseId, action: "catalog.unit.create", entityType: "unit", entityId: unit!.id });
    return c.json({ unit: unit! }, 201);
  });
}

export function createPostgresCatalogStore(pool: Pool): CatalogStore {
  const categoryColumns = `id, warehouse_id AS "warehouseId", code, name, status`;
  const unitColumns = `id, warehouse_id AS "warehouseId", code, name, base_unit_id AS "baseUnitId", conversion_factor AS "conversionFactor", status`;

  return {
    async defaultWarehouseId() {
      const result = await pool.query<{ id: string }>(`SELECT id FROM warehouses ORDER BY code LIMIT 2`);
      return result.rows.length === 1 ? result.rows[0]!.id : null;
    },
    async listCategories(warehouseId, limit, offset) {
      const [rows, count] = await Promise.all([
        pool.query<CatalogCategory>(
          `SELECT ${categoryColumns} FROM categories
           WHERE ($1::uuid IS NULL OR warehouse_id = $1)
           ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [warehouseId, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(*) FROM categories WHERE ($1::uuid IS NULL OR warehouse_id = $1)`,
          [warehouseId],
        ),
      ]);
      return { data: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
    },
    async createCategory(input) {
      const result = await pool.query<CatalogCategory>(
        `INSERT INTO categories (warehouse_id, code, name)
         VALUES ($1, $2, $3) RETURNING ${categoryColumns}`,
        [input.warehouseId, input.code, input.name],
      );
      const category = result.rows[0];
      if (!category) throw new Error("Category insert returned no row");
      return category;
    },
    async listUnits(warehouseId, limit, offset) {
      const [rows, count] = await Promise.all([
        pool.query<CatalogUnit>(
          `SELECT ${unitColumns} FROM units
           WHERE ($1::uuid IS NULL OR warehouse_id = $1)
           ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [warehouseId, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(*) FROM units WHERE ($1::uuid IS NULL OR warehouse_id = $1)`,
          [warehouseId],
        ),
      ]);
      return { data: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
    },
    async findUnit(warehouseId, id) {
      return (await pool.query<CatalogUnit>(
        `SELECT ${unitColumns} FROM units WHERE warehouse_id = $1 AND id = $2`,
        [warehouseId, id],
      )).rows[0] ?? null;
    },
    async createUnit(input) {
      const result = await pool.query<CatalogUnit>(
        `INSERT INTO units (warehouse_id, code, name, base_unit_id, conversion_factor)
         VALUES ($1, $2, $3, $4, $5) RETURNING ${unitColumns}`,
        [input.warehouseId, input.code, input.name, input.baseUnitId, input.conversionFactor],
      );
      const unit = result.rows[0];
      if (!unit) throw new Error("Unit insert returned no row");
      return unit;
    },
  };
}
