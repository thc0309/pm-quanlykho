import type { Context, Hono } from "hono";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson } from "../http/validation.js";
import { auditChange, requireAccess, type AccessActor, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { routePermissionCatalog, type PermissionCode } from "./permissions.js";

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
  defaultWarehouseId(): Promise<string | null>;
  list(warehouseId: string | null): Promise<WarehouseLocation[]>;
  find(warehouseId: string, id: string): Promise<WarehouseLocation | null>;
  create(input: Omit<WarehouseLocation, "id" | "status">): Promise<WarehouseLocation>;
  update(warehouseId: string, id: string, input: Partial<Pick<WarehouseLocation, "name" | "barcode" | "type">>): Promise<WarehouseLocation | null>;
  setStatus(warehouseId: string, id: string, status: WarehouseLocation["status"]): Promise<WarehouseLocation | null>;
  findByBarcode(warehouseId: string, barcode: string): Promise<WarehouseLocation | null>;
}

const locationSchema = z.object({
  code: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/),
  barcode: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["storage", "staging", "shipping"]),
}).strict();
const locationUpdateSchema = z.object({
  barcode: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  type: z.enum(["storage", "staging", "shipping"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Phải có ít nhất một trường cần cập nhật");
const statusSchema = z.object({ status: z.enum(["active", "inactive"]) }).strict();

function routeId(context: Context) {
  const result = z.string().uuid().safeParse(context.req.param("id"));
  if (!result.success) throw new HttpError(422, "VALIDATION_ERROR", "ID không hợp lệ");
  return result.data;
}

function mutationError(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    throw new HttpError(409, "DUPLICATE_LOCATION", "Mã hoặc barcode vị trí đã tồn tại");
  }
  if (error instanceof Error && error.message === "LOCATION_IN_USE") {
    throw new HttpError(409, "LOCATION_IN_USE", "Vị trí còn tồn kho hoặc đang được workflow sử dụng");
  }
  throw error;
}

async function warehouseFor(context: Context, actor: AccessActor, store: LocationStore) {
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

export function registerLocationRoutes(app: Hono, authStore: AuthStore, accessStore: AccessStore, store: LocationStore, sessionSecret: string) {
  const actor = (context: Context, permission: PermissionCode) =>
    requireAccess(context, authStore, accessStore, sessionSecret, { permission });

  app.get("/api/locations", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/locations"]);
    return c.json({ data: await store.list(warehouseScopeFor(c, current)) });
  });

  app.get("/api/locations/:id", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/locations/:id"]);
    const warehouseId = await warehouseFor(c, current, store);
    const location = await store.find(warehouseId, routeId(c));
    if (!location) throw new HttpError(404, "LOCATION_NOT_FOUND", "Không tìm thấy vị trí");
    return c.json({ location });
  });

  app.post("/api/locations", async (c) => {
    const current = await actor(c, routePermissionCatalog["POST /api/locations"]);
    const warehouseId = await warehouseFor(c, current, store);
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

  app.patch("/api/locations/:id", async (c) => {
    const current = await actor(c, routePermissionCatalog["PATCH /api/locations/:id"]);
    const warehouseId = await warehouseFor(c, current, store);
    const input = await parseJson(c, locationUpdateSchema);
    let location: WarehouseLocation | null = null;
    try {
      location = await store.update(warehouseId, routeId(c), input);
    } catch (error) {
      mutationError(error);
    }
    if (!location) throw new HttpError(404, "LOCATION_NOT_FOUND", "Không tìm thấy vị trí");
    await auditChange(accessStore, current, { warehouseId, action: "location.update", entityType: "location", entityId: location.id, metadata: { fields: Object.keys(input) } });
    return c.json({ location });
  });

  app.patch("/api/locations/:id/status", async (c) => {
    const current = await actor(c, routePermissionCatalog["PATCH /api/locations/:id/status"]);
    const warehouseId = await warehouseFor(c, current, store);
    const { status } = await parseJson(c, statusSchema);
    let location: WarehouseLocation | null = null;
    try {
      location = await store.setStatus(warehouseId, routeId(c), status);
    } catch (error) {
      mutationError(error);
    }
    if (!location) throw new HttpError(404, "LOCATION_NOT_FOUND", "Không tìm thấy vị trí");
    await auditChange(accessStore, current, { warehouseId, action: "location.status", entityType: "location", entityId: location.id, metadata: { status } });
    return c.json({ location });
  });

  app.get("/api/locations/lookup/:barcode", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/locations/lookup/:barcode"]);
    const warehouseId = await warehouseFor(c, current, store);
    const barcode = z.string().trim().min(1).max(100).safeParse(c.req.param("barcode"));
    if (!barcode.success) throw new HttpError(422, "VALIDATION_ERROR", "Barcode không hợp lệ");
    const location = await store.findByBarcode(warehouseId, barcode.data);
    if (!location) throw new HttpError(404, "LOCATION_NOT_FOUND", "Không tìm thấy vị trí");
    return c.json({ location });
  });
}

async function locationInUse(client: PoolClient, id: string, barcode: string) {
  const result = await client.query<{ inUse: boolean }>(
    `SELECT
      EXISTS (SELECT 1 FROM stock_balances WHERE location_id = $1 AND on_hand <> 0)
      OR EXISTS (
        SELECT 1 FROM stock_document_lines line
        JOIN stock_documents document ON document.id = line.document_id
        WHERE line.location_id = $1 AND document.status NOT IN ('confirmed', 'shipped', 'cancelled', 'reversed')
      )
      OR EXISTS (SELECT 1 FROM stock_reservations WHERE location_id = $1 AND status IN ('reserved', 'picked'))
      OR EXISTS (
        SELECT 1 FROM warehouse_transfer_lines line
        JOIN warehouse_transfers transfer ON transfer.id = line.transfer_id
        WHERE (line.source_location_id = $1 OR line.target_location_id = $1)
          AND transfer.status IN ('draft', 'in_transit')
      )
      OR EXISTS (
        SELECT 1 FROM picking_scans scan JOIN stock_documents document ON document.id = scan.document_id
        WHERE scan.location_barcode = $2 AND document.status IN ('ready_to_pick', 'picking', 'needs_repick')
      )
      OR EXISTS (
        SELECT 1 FROM checking_scans scan JOIN stock_documents document ON document.id = scan.document_id
        WHERE scan.location_barcode = $2 AND document.status = 'checking'
      ) AS "inUse"`,
    [id, barcode],
  );
  return result.rows[0]?.inUse ?? false;
}

export function createPostgresLocationStore(pool: Pool): LocationStore {
  const columns = `id, warehouse_id AS "warehouseId", code, barcode, name, type, status`;
  return {
    async defaultWarehouseId() {
      const result = await pool.query<{ id: string }>(
        `SELECT id FROM warehouses ORDER BY code LIMIT 2`,
      );
      return result.rows.length === 1 ? result.rows[0]!.id : null;
    },
    async list(warehouseId) {
      return (await pool.query<WarehouseLocation>(`SELECT ${columns} FROM locations WHERE ($1::uuid IS NULL OR warehouse_id = $1) ORDER BY code`, [warehouseId])).rows;
    },
    async find(warehouseId, id) {
      return (await pool.query<WarehouseLocation>(
        `SELECT ${columns} FROM locations WHERE warehouse_id = $1 AND id = $2`,
        [warehouseId, id],
      )).rows[0] ?? null;
    },
    async create(input) {
      const result = await pool.query<WarehouseLocation>(`INSERT INTO locations (warehouse_id, code, barcode, name, type) VALUES ($1, $2, $3, $4, $5) RETURNING ${columns}`, [input.warehouseId, input.code, input.barcode, input.name, input.type]);
      const location = result.rows[0];
      if (!location) throw new Error("Location insert returned no row");
      return location;
    },
    async update(warehouseId, id, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const current = (await client.query<WarehouseLocation>(
          `SELECT ${columns} FROM locations WHERE warehouse_id = $1 AND id = $2 FOR UPDATE`,
          [warehouseId, id],
        )).rows[0];
        if (!current) {
          await client.query("ROLLBACK");
          return null;
        }
        if (input.type && input.type !== current.type && await locationInUse(client, id, current.barcode)) {
          throw new Error("LOCATION_IN_USE");
        }
        const location = (await client.query<WarehouseLocation>(
          `UPDATE locations SET
             name = COALESCE($3, name), barcode = COALESCE($4, barcode),
             type = COALESCE($5, type), updated_at = now()
           WHERE warehouse_id = $1 AND id = $2 RETURNING ${columns}`,
          [warehouseId, id, input.name ?? null, input.barcode ?? null, input.type ?? null],
        )).rows[0] ?? null;
        await client.query("COMMIT");
        return location;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async setStatus(warehouseId, id, status) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const current = (await client.query<WarehouseLocation>(
          `SELECT ${columns} FROM locations WHERE warehouse_id = $1 AND id = $2 FOR UPDATE`,
          [warehouseId, id],
        )).rows[0];
        if (!current) {
          await client.query("ROLLBACK");
          return null;
        }
        if (status === "inactive" && current.status !== "inactive" && await locationInUse(client, id, current.barcode)) {
          throw new Error("LOCATION_IN_USE");
        }
        const location = (await client.query<WarehouseLocation>(
          `UPDATE locations SET status = $3, updated_at = now()
           WHERE warehouse_id = $1 AND id = $2 RETURNING ${columns}`,
          [warehouseId, id, status],
        )).rows[0] ?? null;
        await client.query("COMMIT");
        return location;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async findByBarcode(warehouseId, barcode) {
      return (await pool.query<WarehouseLocation>(`SELECT ${columns} FROM locations WHERE warehouse_id = $1 AND barcode = $2 AND status = 'active'`, [warehouseId, barcode])).rows[0] ?? null;
    },
  };
}
