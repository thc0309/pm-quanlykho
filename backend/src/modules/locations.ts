import type { Context, Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson } from "../http/validation.js";
import { auditChange, requireAccess, type AccessActor, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";

export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  code: string;
  barcode: string;
  name: string;
  type: "storage" | "staging" | "shipping";
  status: "active" | "inactive";
}

export interface LocationStore {
  list(warehouseId: string): Promise<WarehouseLocation[]>;
  create(input: Omit<WarehouseLocation, "id" | "status">): Promise<WarehouseLocation>;
  findByBarcode(warehouseId: string, barcode: string): Promise<WarehouseLocation | null>;
}

const locationSchema = z.object({
  code: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/),
  barcode: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["storage", "staging", "shipping"]),
}).strict();

function warehouseFor(context: Context, actor: AccessActor) {
  if (actor.user.kind !== "master_admin") {
    if (!actor.user.warehouseId) throw new HttpError(403, "FORBIDDEN", "Không có kho");
    return actor.user.warehouseId;
  }
  const result = z.string().uuid().safeParse(context.req.query("warehouseId"));
  if (!result.success) throw new HttpError(422, "VALIDATION_ERROR", "Master phải chọn warehouseId hợp lệ");
  return result.data;
}

export function registerLocationRoutes(app: Hono, authStore: AuthStore, accessStore: AccessStore, store: LocationStore, sessionSecret: string) {
  const actor = (context: Context, manage = false) => requireAccess(context, authStore, accessStore, sessionSecret, manage ? { permission: "admin.access.manage" } : {});

  app.get("/api/locations", async (c) => {
    const current = await actor(c, true);
    return c.json({ data: await store.list(warehouseFor(c, current)) });
  });

  app.post("/api/locations", async (c) => {
    const current = await actor(c, true);
    const warehouseId = warehouseFor(c, current);
    const input = await parseJson(c, locationSchema);
    let location: WarehouseLocation;
    try {
      location = await store.create({ ...input, warehouseId });
    } catch (error) {
      if ((error as { code?: string }).code !== "23505") throw error;
      throw new HttpError(409, "DUPLICATE_LOCATION", "Mã hoặc barcode vị trí đã tồn tại");
    }
    await auditChange(accessStore, current, { warehouseId, action: "location.create", entityType: "location", entityId: location.id });
    return c.json({ location }, 201);
  });

  app.get("/api/locations/lookup/:barcode", async (c) => {
    const current = await actor(c);
    const warehouseId = warehouseFor(c, current);
    const barcode = z.string().trim().min(1).max(100).safeParse(c.req.param("barcode"));
    if (!barcode.success) throw new HttpError(422, "VALIDATION_ERROR", "Barcode không hợp lệ");
    const location = await store.findByBarcode(warehouseId, barcode.data);
    if (!location) throw new HttpError(404, "LOCATION_NOT_FOUND", "Không tìm thấy vị trí");
    return c.json({ location });
  });
}

export function createPostgresLocationStore(pool: Pool): LocationStore {
  const columns = `id, warehouse_id AS "warehouseId", code, barcode, name, type, status`;
  return {
    async list(warehouseId) {
      return (await pool.query<WarehouseLocation>(`SELECT ${columns} FROM locations WHERE warehouse_id = $1 ORDER BY code`, [warehouseId])).rows;
    },
    async create(input) {
      const result = await pool.query<WarehouseLocation>(`INSERT INTO locations (warehouse_id, code, barcode, name, type) VALUES ($1, $2, $3, $4, $5) RETURNING ${columns}`, [input.warehouseId, input.code, input.barcode, input.name, input.type]);
      const location = result.rows[0];
      if (!location) throw new Error("Location insert returned no row");
      return location;
    },
    async findByBarcode(warehouseId, barcode) {
      return (await pool.query<WarehouseLocation>(`SELECT ${columns} FROM locations WHERE warehouse_id = $1 AND barcode = $2 AND status = 'active'`, [warehouseId, barcode])).rows[0] ?? null;
    },
  };
}
