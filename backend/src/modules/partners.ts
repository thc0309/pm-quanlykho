import type { Context, Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import { auditChange, requireAccess, type AccessActor, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { routePermissionCatalog, type PermissionCode } from "./permissions.js";

type Page<T> = { data: T[]; total: number };

export interface Partner {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  kind: "customer" | "supplier";
  taxCode: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: "active" | "inactive";
}

export interface PartnerStore {
  defaultWarehouseId(): Promise<string | null>;
  listPartners(warehouseId: string | null, limit: number, offset: number): Promise<Page<Partner>>;
  findPartner(warehouseId: string, id: string): Promise<Partner | null>;
  createPartner(input: Omit<Partner, "id" | "status">): Promise<Partner>;
  updatePartner(warehouseId: string, id: string, input: Partial<Pick<Partner, "name" | "taxCode" | "phone" | "email" | "address">>): Promise<Partner | null>;
  setPartnerStatus(warehouseId: string, id: string, status: Partner["status"]): Promise<Partner | null>;
}

const optionalText = z.string().trim().max(255).optional();
const partnerSchema = z.object({
  code: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(160),
  kind: z.enum(["customer", "supplier"]),
  taxCode: optionalText,
  phone: optionalText,
  email: z.string().trim().email().max(254).optional(),
  address: optionalText,
}).strict();
const partnerUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  taxCode: optionalText,
  phone: optionalText,
  email: z.string().trim().email().max(254).optional(),
  address: optionalText,
}).strict();
const statusSchema = z.object({ status: z.enum(["active", "inactive"]) }).strict();

async function warehouseFor(context: Context, actor: AccessActor, store: PartnerStore) {
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
    throw new HttpError(409, "DUPLICATE", "Mã đối tác đã tồn tại");
  }
  throw error;
}

function pageResponse<T>(data: Page<T>, page: number, pageSize: number) {
  return {
    data: data.data,
    pagination: { page, pageSize, totalItems: data.total, totalPages: Math.ceil(data.total / pageSize) },
  };
}

export function registerPartnerRoutes(
  app: Hono,
  authStore: AuthStore,
  accessStore: AccessStore,
  store: PartnerStore,
  sessionSecret: string,
) {
  const actor = (context: Context, permission: PermissionCode) =>
    requireAccess(context, authStore, accessStore, sessionSecret, { permission });

  app.get("/api/partners", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/partners"]);
    const pagination = parsePagination(c.req.query());
    const result = await store.listPartners(warehouseScopeFor(c, current), pagination.pageSize, pagination.offset);
    return c.json(pageResponse(result, pagination.page, pagination.pageSize));
  });

  app.get("/api/partners/:id", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/partners/:id"]);
    const warehouseId = await warehouseFor(c, current, store);
    const partner = await store.findPartner(warehouseId, c.req.param("id"));
    if (!partner) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy đối tác");
    return c.json({ partner });
  });

  app.post("/api/partners", async (c) => {
    const current = await actor(c, routePermissionCatalog["POST /api/partners"]);
    const warehouseId = await warehouseFor(c, current, store);
    const input = await parseJson(c, partnerSchema);
    let partner: Partner;
    try {
      partner = await store.createPartner({
        ...input,
        warehouseId,
        taxCode: input.taxCode || null,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
      });
    } catch (error) {
      conflict(error);
    }
    await auditChange(accessStore, current, { warehouseId, action: "partners.create", entityType: "partner", entityId: partner!.id });
    return c.json({ partner: partner! }, 201);
  });

  app.patch("/api/partners/:id", async (c) => {
    const current = await actor(c, routePermissionCatalog["PATCH /api/partners/:id"]);
    const warehouseId = await warehouseFor(c, current, store);
    const input = await parseJson(c, partnerUpdateSchema);
    const update: Partial<Pick<Partner, "name" | "taxCode" | "phone" | "email" | "address">> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.taxCode !== undefined) update.taxCode = input.taxCode || null;
    if (input.phone !== undefined) update.phone = input.phone || null;
    if (input.email !== undefined) update.email = input.email || null;
    if (input.address !== undefined) update.address = input.address || null;
    const partner = await store.updatePartner(warehouseId, c.req.param("id"), update);
    if (!partner) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy đối tác");
    await auditChange(accessStore, current, { warehouseId, action: "partners.update", entityType: "partner", entityId: partner.id });
    return c.json({ partner });
  });

  app.patch("/api/partners/:id/status", async (c) => {
    const current = await actor(c, routePermissionCatalog["PATCH /api/partners/:id/status"]);
    const warehouseId = await warehouseFor(c, current, store);
    const input = await parseJson(c, statusSchema);
    const partner = await store.setPartnerStatus(warehouseId, c.req.param("id"), input.status);
    if (!partner) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy đối tác");
    await auditChange(accessStore, current, { warehouseId, action: "partners.status", entityType: "partner", entityId: partner.id });
    return c.json({ partner });
  });
}

export function createPostgresPartnerStore(pool: Pool): PartnerStore {
  const columns = `id, warehouse_id AS "warehouseId", code, name, kind, tax_code AS "taxCode", phone, email, address, status`;

  return {
    async defaultWarehouseId() {
      const result = await pool.query<{ id: string }>(`SELECT id FROM warehouses ORDER BY code LIMIT 2`);
      return result.rows.length === 1 ? result.rows[0]!.id : null;
    },
    async listPartners(warehouseId, limit, offset) {
      const [rows, count] = await Promise.all([
        pool.query<Partner>(
          `SELECT ${columns} FROM partners
           WHERE ($1::uuid IS NULL OR warehouse_id = $1)
           ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [warehouseId, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(*) FROM partners WHERE ($1::uuid IS NULL OR warehouse_id = $1)`,
          [warehouseId],
        ),
      ]);
      return { data: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
    },
    async findPartner(warehouseId, id) {
      return (await pool.query<Partner>(
        `SELECT ${columns} FROM partners WHERE warehouse_id = $1 AND id = $2`,
        [warehouseId, id],
      )).rows[0] ?? null;
    },
    async createPartner(input) {
      const result = await pool.query<Partner>(
        `INSERT INTO partners (warehouse_id, code, name, kind, tax_code, phone, email, address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${columns}`,
        [input.warehouseId, input.code, input.name, input.kind, input.taxCode, input.phone, input.email, input.address],
      );
      const partner = result.rows[0];
      if (!partner) throw new Error("Partner insert returned no row");
      return partner;
    },
    async updatePartner(warehouseId, id, input) {
      const result = await pool.query<Partner>(
        `UPDATE partners SET
           name = COALESCE($3, name),
           tax_code = COALESCE($4, tax_code),
           phone = COALESCE($5, phone),
           email = COALESCE($6, email),
           address = COALESCE($7, address),
           updated_at = now()
         WHERE warehouse_id = $1 AND id = $2
         RETURNING ${columns}`,
        [warehouseId, id, input.name, input.taxCode, input.phone, input.email, input.address],
      );
      return result.rows[0] ?? null;
    },
    async setPartnerStatus(warehouseId, id, status) {
      const result = await pool.query<Partner>(
        `UPDATE partners SET status = $3, updated_at = now()
         WHERE warehouse_id = $1 AND id = $2
         RETURNING ${columns}`,
        [warehouseId, id, status],
      );
      return result.rows[0] ?? null;
    },
  };
}
