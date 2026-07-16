import type { Context, Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parsePagination } from "../http/validation.js";
import { requireAccess, type AccessActor, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { routePermissionCatalog } from "./permissions.js";

type Page<T> = { data: T[]; total: number };

export interface InventoryFilters {
  q?: string;
  productId?: string;
  locationId?: string;
  lotCode?: string;
  serialCode?: string;
}

export interface InventoryBalance {
  id?: string;
  warehouseId: string;
  locationId: string;
  locationCode: string;
  productId: string;
  sku: string;
  productName: string;
  lotCode: string | null;
  serialCode: string | null;
  onHand: number;
  committed: number;
  available: number;
}

export interface InventoryLot {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  lotCode: string;
  manufacturedAt: string | null;
  expiresAt: string | null;
  onHand: number;
}

export interface InventorySerial {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  serialCode: string;
  status: "in_stock" | "issued" | "returned" | "scrapped";
  locationCode: string | null;
  onHand: number;
}

export interface InventoryMovement {
  id: string;
  documentNo: string;
  documentType: string;
  locationCode: string | null;
  productId: string;
  sku: string;
  productName: string;
  lotCode: string | null;
  serialCode: string | null;
  quantityDelta: number;
  createdAt: string;
}

export interface InventoryStore {
  listBalances(warehouseId: string | null, filters: InventoryFilters, limit: number, offset: number): Promise<Page<InventoryBalance>>;
  listLots(warehouseId: string | null, filters: InventoryFilters, limit: number, offset: number): Promise<Page<InventoryLot>>;
  listSerials(warehouseId: string | null, filters: InventoryFilters, limit: number, offset: number): Promise<Page<InventorySerial>>;
  listMovements(warehouseId: string | null, filters: InventoryFilters, limit: number, offset: number): Promise<Page<InventoryMovement>>;
}

const filterSchema = z.object({
  q: z.string().trim().min(1).max(80).optional(),
  productId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  lotCode: z.string().trim().min(1).max(120).optional(),
  serialCode: z.string().trim().min(1).max(120).optional(),
});

function parseFilters(context: Context): InventoryFilters {
  const result = filterSchema.safeParse({
    q: context.req.query("q") || undefined,
    productId: context.req.query("productId") || undefined,
    locationId: context.req.query("locationId") || undefined,
    lotCode: context.req.query("lotCode") || undefined,
    serialCode: context.req.query("serialCode") || undefined,
  });
  if (!result.success) {
    throw new HttpError(422, "VALIDATION_ERROR", "Bộ lọc tồn kho không hợp lệ", result.error.flatten());
  }
  return result.data;
}

function warehouseScopeFor(context: Context, actor: AccessActor) {
  if (actor.user.kind !== "master_admin") {
    if (!actor.user.warehouseId) throw new HttpError(403, "FORBIDDEN", "Không có kho");
    return actor.user.warehouseId;
  }
  const requested = context.req.query("warehouseId");
  if (!requested) return null;
  const parsed = z.string().uuid().safeParse(requested);
  if (!parsed.success) throw new HttpError(422, "VALIDATION_ERROR", "warehouseId không hợp lệ");
  return parsed.data;
}

function pageResponse<T>(result: Page<T>, page: number, pageSize: number) {
  return {
    data: result.data,
    pagination: { page, pageSize, totalItems: result.total, totalPages: Math.ceil(result.total / pageSize) },
  };
}

export function registerInventoryRoutes(
  app: Hono,
  authStore: AuthStore,
  accessStore: AccessStore,
  store: InventoryStore,
  sessionSecret: string,
) {
  const actor = (context: Context) => requireAccess(context, authStore, accessStore, sessionSecret, {
    permission: routePermissionCatalog["GET /api/inventory/balances"],
  });
  const route = <T>(path: string, load: InventoryStore[keyof InventoryStore]) => {
    app.get(path, async (c) => {
      const current = await actor(c);
      const pagination = parsePagination(c.req.query());
      const result = await load(warehouseScopeFor(c, current), parseFilters(c), pagination.pageSize, pagination.offset) as Page<T>;
      return c.json(pageResponse(result, pagination.page, pagination.pageSize));
    });
  };

  route<InventoryBalance>("/api/inventory/balances", store.listBalances.bind(store));
  route<InventoryLot>("/api/inventory/lots", store.listLots.bind(store));
  route<InventorySerial>("/api/inventory/serials", store.listSerials.bind(store));
  route<InventoryMovement>("/api/inventory/movements", store.listMovements.bind(store));
}

export function createPostgresInventoryStore(pool: Pool): InventoryStore {
  return {
    async listBalances(warehouseId, filters, limit, offset) {
      const params = [warehouseId, filters.productId ?? null, filters.locationId ?? null, filters.lotCode ?? null, filters.serialCode ?? null, filters.q ?? null];
      const where = `($1::uuid IS NULL OR sb.warehouse_id = $1)
        AND ($2::uuid IS NULL OR sb.product_id = $2)
        AND ($3::uuid IS NULL OR sb.location_id = $3)
        AND ($4::text IS NULL OR lot.lot_code = $4)
        AND ($5::text IS NULL OR serial.serial_code = $5)
        AND ($6::text IS NULL OR p.sku ILIKE '%' || $6 || '%' OR p.name ILIKE '%' || $6 || '%' OR loc.code ILIKE '%' || $6 || '%')`;
      const [rows, count] = await Promise.all([
        pool.query<InventoryBalance & { onHand: string; committed: string; available: string }>(
          `SELECT sb.id, sb.warehouse_id AS "warehouseId", sb.location_id AS "locationId", loc.code AS "locationCode",
                  sb.product_id AS "productId", p.sku, p.name AS "productName", lot.lot_code AS "lotCode",
                  serial.serial_code AS "serialCode", sb.on_hand AS "onHand", coalesce(r.committed, 0) AS committed,
                  sb.on_hand - coalesce(r.committed, 0) AS available
           FROM stock_balances sb
           JOIN products p ON p.id = sb.product_id
           JOIN locations loc ON loc.id = sb.location_id
           LEFT JOIN lots lot ON lot.id = sb.lot_id
           LEFT JOIN serials serial ON serial.id = sb.serial_id
           LEFT JOIN LATERAL (
             SELECT sum(quantity) AS committed FROM stock_reservations
             WHERE stock_balance_id = sb.id AND (status = 'picked' OR (status = 'reserved' AND expires_at > now()))
           ) r ON true
           WHERE ${where}
           ORDER BY p.sku, loc.code, lot.expires_at NULLS LAST, serial.serial_code
           LIMIT $7 OFFSET $8`,
          [...params, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(*) FROM stock_balances sb
           JOIN products p ON p.id = sb.product_id
           JOIN locations loc ON loc.id = sb.location_id
           LEFT JOIN lots lot ON lot.id = sb.lot_id
           LEFT JOIN serials serial ON serial.id = sb.serial_id
           WHERE ${where}`,
          params,
        ),
      ]);
      return {
        data: rows.rows.map((row) => ({ ...row, onHand: Number(row.onHand), committed: Number(row.committed), available: Number(row.available) })),
        total: Number(count.rows[0]?.count ?? 0),
      };
    },
    async listLots(warehouseId, filters, limit, offset) {
      const params = [warehouseId, filters.productId ?? null, filters.locationId ?? null, filters.lotCode ?? null, filters.q ?? null];
      const where = `($1::uuid IS NULL OR lot.warehouse_id = $1)
        AND ($2::uuid IS NULL OR lot.product_id = $2)
        AND ($3::uuid IS NULL OR sb.location_id = $3)
        AND ($4::text IS NULL OR lot.lot_code = $4)
        AND ($5::text IS NULL OR p.sku ILIKE '%' || $5 || '%' OR p.name ILIKE '%' || $5 || '%' OR lot.lot_code ILIKE '%' || $5 || '%')`;
      const [rows, count] = await Promise.all([
        pool.query<InventoryLot & { onHand: string }>(
          `SELECT lot.id, lot.product_id AS "productId", p.sku, p.name AS "productName", lot.lot_code AS "lotCode",
                  lot.manufactured_at AS "manufacturedAt", lot.expires_at AS "expiresAt", coalesce(sum(sb.on_hand), 0) AS "onHand"
           FROM lots lot JOIN products p ON p.id = lot.product_id
           LEFT JOIN stock_balances sb ON sb.lot_id = lot.id
           WHERE ${where}
           GROUP BY lot.id, p.id
           ORDER BY lot.expires_at NULLS LAST, lot.lot_code
           LIMIT $6 OFFSET $7`,
          [...params, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(DISTINCT lot.id) FROM lots lot JOIN products p ON p.id = lot.product_id
           LEFT JOIN stock_balances sb ON sb.lot_id = lot.id WHERE ${where}`,
          params,
        ),
      ]);
      return { data: rows.rows.map((row) => ({ ...row, onHand: Number(row.onHand) })), total: Number(count.rows[0]?.count ?? 0) };
    },
    async listSerials(warehouseId, filters, limit, offset) {
      const params = [warehouseId, filters.productId ?? null, filters.locationId ?? null, filters.serialCode ?? null, filters.q ?? null];
      const where = `($1::uuid IS NULL OR serial.warehouse_id = $1)
        AND ($2::uuid IS NULL OR serial.product_id = $2)
        AND ($3::uuid IS NULL OR sb.location_id = $3)
        AND ($4::text IS NULL OR serial.serial_code = $4)
        AND ($5::text IS NULL OR p.sku ILIKE '%' || $5 || '%' OR p.name ILIKE '%' || $5 || '%' OR serial.serial_code ILIKE '%' || $5 || '%')`;
      const [rows, count] = await Promise.all([
        pool.query<InventorySerial & { onHand: string }>(
          `SELECT serial.id, serial.product_id AS "productId", p.sku, p.name AS "productName",
                  serial.serial_code AS "serialCode", serial.status, max(loc.code) FILTER (WHERE sb.on_hand > 0) AS "locationCode",
                  coalesce(sum(sb.on_hand), 0) AS "onHand"
           FROM serials serial JOIN products p ON p.id = serial.product_id
           LEFT JOIN stock_balances sb ON sb.serial_id = serial.id
           LEFT JOIN locations loc ON loc.id = sb.location_id
           WHERE ${where}
           GROUP BY serial.id, p.id
           ORDER BY serial.serial_code
           LIMIT $6 OFFSET $7`,
          [...params, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(DISTINCT serial.id) FROM serials serial JOIN products p ON p.id = serial.product_id
           LEFT JOIN stock_balances sb ON sb.serial_id = serial.id WHERE ${where}`,
          params,
        ),
      ]);
      return { data: rows.rows.map((row) => ({ ...row, onHand: Number(row.onHand) })), total: Number(count.rows[0]?.count ?? 0) };
    },
    async listMovements(warehouseId, filters, limit, offset) {
      const params = [warehouseId, filters.productId ?? null, filters.locationId ?? null, filters.lotCode ?? null, filters.serialCode ?? null, filters.q ?? null];
      const where = `($1::uuid IS NULL OR m.warehouse_id = $1)
        AND ($2::uuid IS NULL OR m.product_id = $2)
        AND ($3::uuid IS NULL OR m.location_id = $3)
        AND ($4::text IS NULL OR lot.lot_code = $4)
        AND ($5::text IS NULL OR serial.serial_code = $5)
        AND ($6::text IS NULL OR p.sku ILIKE '%' || $6 || '%' OR p.name ILIKE '%' || $6 || '%' OR d.document_no ILIKE '%' || $6 || '%')`;
      const [rows, count] = await Promise.all([
        pool.query<InventoryMovement & { quantityDelta: string }>(
          `SELECT m.id, d.document_no AS "documentNo", d.document_type AS "documentType", loc.code AS "locationCode",
                  m.product_id AS "productId", p.sku, p.name AS "productName", lot.lot_code AS "lotCode",
                  serial.serial_code AS "serialCode", m.quantity_delta AS "quantityDelta", m.created_at AS "createdAt"
           FROM stock_movements m JOIN stock_documents d ON d.id = m.document_id
           JOIN products p ON p.id = m.product_id LEFT JOIN locations loc ON loc.id = m.location_id
           LEFT JOIN lots lot ON lot.id = m.lot_id LEFT JOIN serials serial ON serial.id = m.serial_id
           WHERE ${where} ORDER BY m.created_at DESC LIMIT $7 OFFSET $8`,
          [...params, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(*) FROM stock_movements m JOIN stock_documents d ON d.id = m.document_id
           JOIN products p ON p.id = m.product_id LEFT JOIN locations loc ON loc.id = m.location_id
           LEFT JOIN lots lot ON lot.id = m.lot_id LEFT JOIN serials serial ON serial.id = m.serial_id
           WHERE ${where}`,
          params,
        ),
      ]);
      return { data: rows.rows.map((row) => ({ ...row, quantityDelta: Number(row.quantityDelta) })), total: Number(count.rows[0]?.count ?? 0) };
    },
  };
}
