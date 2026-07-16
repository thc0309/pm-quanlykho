import type { Context, Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import { auditChange, requireAccess, type AccessActor, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { routePermissionCatalog, type PermissionCode } from "./permissions.js";

type Page<T> = { data: T[]; total: number };
export type OutboundStatus = "draft" | "ready_to_pick" | "picking" | "picked" | "checking" | "needs_repick" | "shipped" | "cancelled";

export interface OutboundLineInput { productId: string; quantity: number }
export interface Outbound {
  id: string;
  warehouseId: string;
  documentNo: string;
  status: OutboundStatus;
  lineCount: number;
  reservedUntil: string | null;
  createdAt: string;
}
export interface OutboundStore {
  defaultWarehouseId(): Promise<string | null>;
  createOutbound(input: { warehouseId: string; createdByUserId: string; documentNo: string; partnerId?: string; lines: OutboundLineInput[] }): Promise<Outbound>;
  listOutbounds(warehouseId: string | null, limit: number, offset: number): Promise<Page<Outbound>>;
  releaseOutbound(warehouseId: string, documentId: string): Promise<{ documentId: string; reservationCount: number; alreadyReleased: boolean; reservedUntil: string }>;
}

const outboundSchema = z.object({
  documentNo: z.string().trim().min(1).max(80),
  partnerId: z.string().uuid().optional(),
  lines: z.array(z.object({ productId: z.string().uuid(), quantity: z.coerce.number().positive().finite() }).strict()).min(1).max(200),
}).strict();

async function warehouseFor(context: Context, actor: AccessActor, store: OutboundStore) {
  if (actor.user.kind !== "master_admin") {
    if (!actor.user.warehouseId) throw new HttpError(403, "FORBIDDEN", "Không có kho");
    return actor.user.warehouseId;
  }
  const requested = context.req.query("warehouseId");
  if (!requested) {
    const fallback = await store.defaultWarehouseId();
    if (fallback) return fallback;
  }
  const parsed = z.string().uuid().safeParse(requested);
  if (!parsed.success) throw new HttpError(422, "VALIDATION_ERROR", "Master phải chọn warehouseId hợp lệ");
  return parsed.data;
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

function outboundError(error: unknown): never {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : error instanceof Error ? error.message : "";
  if (code === "OUTBOUND_NOT_FOUND" || code === "SCOPE_NOT_FOUND") throw new HttpError(404, "NOT_FOUND", "Không tìm thấy phiếu xuất hoặc dữ liệu trong kho");
  if (code === "INSUFFICIENT_STOCK") throw new HttpError(409, code, "Không đủ tồn khả dụng để giữ hàng");
  if (code === "INVALID_STATE") throw new HttpError(409, code, "Phiếu xuất không ở trạng thái có thể release");
  if (code === "23505") throw new HttpError(409, "DUPLICATE", "Số phiếu đã tồn tại");
  throw error;
}

export function registerOutboundRoutes(app: Hono, authStore: AuthStore, accessStore: AccessStore, store: OutboundStore, sessionSecret: string) {
  const actor = (context: Context, permission: PermissionCode) => requireAccess(context, authStore, accessStore, sessionSecret, { permission });
  app.get("/api/outbounds", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/outbounds"]);
    const pagination = parsePagination(c.req.query());
    const result = await store.listOutbounds(warehouseScopeFor(c, current), pagination.pageSize, pagination.offset);
    return c.json({ data: result.data, pagination: { page: pagination.page, pageSize: pagination.pageSize, totalItems: result.total, totalPages: Math.ceil(result.total / pagination.pageSize) } });
  });
  app.post("/api/outbounds", async (c) => {
    const current = await actor(c, routePermissionCatalog["POST /api/outbounds"]);
    const warehouseId = await warehouseFor(c, current, store);
    const input = await parseJson(c, outboundSchema);
    try {
      const outbound = await store.createOutbound({ ...input, warehouseId, createdByUserId: current.user.id });
      await auditChange(accessStore, current, { warehouseId, action: "outbound.create", entityType: "stock_document", entityId: outbound.id });
      return c.json({ outbound }, 201);
    } catch (error) { outboundError(error); }
  });
  app.post("/api/outbounds/:id/release", async (c) => {
    const current = await actor(c, routePermissionCatalog["POST /api/outbounds/:id/release"]);
    const warehouseId = await warehouseFor(c, current, store);
    const id = z.string().uuid().safeParse(c.req.param("id"));
    if (!id.success) throw new HttpError(422, "VALIDATION_ERROR", "ID phiếu không hợp lệ");
    try {
      const result = await store.releaseOutbound(warehouseId, id.data);
      if (!result.alreadyReleased) await auditChange(accessStore, current, { warehouseId, action: "outbound.release", entityType: "stock_document", entityId: id.data, metadata: { reservationCount: result.reservationCount } });
      return c.json({ result });
    } catch (error) { outboundError(error); }
  });
}

export function createPostgresOutboundStore(pool: Pool): OutboundStore {
  async function expireReservations(warehouseId: string | null) {
    await pool.query(
      `WITH expired AS (
         UPDATE stock_reservations SET status = 'released', updated_at = now()
         WHERE status = 'reserved' AND expires_at <= now() AND ($1::uuid IS NULL OR warehouse_id = $1)
         RETURNING document_id
       )
       UPDATE stock_documents d SET status = 'draft', updated_at = now()
       WHERE d.status = 'ready_to_pick' AND d.id IN (SELECT document_id FROM expired)
         AND NOT EXISTS (SELECT 1 FROM stock_reservations r WHERE r.document_id = d.id AND r.status = 'reserved' AND r.expires_at > now())`,
      [warehouseId],
    );
  }

  return {
    async defaultWarehouseId() {
      const result = await pool.query<{ id: string }>("SELECT id FROM warehouses ORDER BY code LIMIT 2");
      return result.rows.length === 1 ? result.rows[0]!.id : null;
    },
    async createOutbound(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (input.partnerId) {
          const partner = await client.query("SELECT 1 FROM partners WHERE id = $1 AND warehouse_id = $2 AND status = 'active'", [input.partnerId, input.warehouseId]);
          if (!partner.rowCount) throw new Error("SCOPE_NOT_FOUND");
        }
        const document = await client.query<{ id: string; createdAt: string }>(
          `INSERT INTO stock_documents (warehouse_id, partner_id, document_no, document_type, status, created_by)
           VALUES ($1, $2, $3, 'issue', 'draft', $4) RETURNING id, created_at AS "createdAt"`,
          [input.warehouseId, input.partnerId ?? null, input.documentNo, input.createdByUserId],
        );
        const row = document.rows[0]!;
        for (const line of input.lines) {
          const product = await client.query("SELECT 1 FROM products WHERE id = $1 AND warehouse_id = $2 AND status = 'active' AND product_type = 'stock'", [line.productId, input.warehouseId]);
          if (!product.rowCount) throw new Error("SCOPE_NOT_FOUND");
          await client.query("INSERT INTO stock_document_lines (document_id, product_id, quantity, snapshot) VALUES ($1, $2, $3, '{}'::jsonb)", [row.id, line.productId, line.quantity]);
        }
        await client.query("COMMIT");
        return { id: row.id, warehouseId: input.warehouseId, documentNo: input.documentNo, status: "draft", lineCount: input.lines.length, reservedUntil: null, createdAt: row.createdAt };
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    },
    async listOutbounds(warehouseId, limit, offset) {
      await expireReservations(warehouseId);
      const [rows, count] = await Promise.all([
        pool.query<Outbound & { lineCount: string }>(
          `SELECT d.id, d.warehouse_id AS "warehouseId", d.document_no AS "documentNo", d.status,
                  count(DISTINCT l.id) AS "lineCount", max(r.expires_at) FILTER (WHERE r.status = 'reserved') AS "reservedUntil", d.created_at AS "createdAt"
           FROM stock_documents d LEFT JOIN stock_document_lines l ON l.document_id = d.id
           LEFT JOIN stock_reservations r ON r.document_id = d.id
           WHERE d.document_type = 'issue' AND ($1::uuid IS NULL OR d.warehouse_id = $1)
           GROUP BY d.id ORDER BY d.created_at DESC LIMIT $2 OFFSET $3`, [warehouseId, limit, offset]),
        pool.query<{ count: string }>("SELECT count(*) FROM stock_documents WHERE document_type = 'issue' AND ($1::uuid IS NULL OR warehouse_id = $1)", [warehouseId]),
      ]);
      return { data: rows.rows.map(row => ({ ...row, lineCount: Number(row.lineCount) })), total: Number(count.rows[0]?.count ?? 0) };
    },
    async releaseOutbound(warehouseId, documentId) {
      await expireReservations(warehouseId);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const document = await client.query<{ status: OutboundStatus }>("SELECT status FROM stock_documents WHERE id = $1 AND warehouse_id = $2 AND document_type = 'issue' FOR UPDATE", [documentId, warehouseId]);
        const status = document.rows[0]?.status;
        if (!status) throw new Error("OUTBOUND_NOT_FOUND");
        if (status === "ready_to_pick") {
          const existing = await client.query<{ count: string; reservedUntil: string }>("SELECT count(*)::text AS count, max(expires_at) AS \"reservedUntil\" FROM stock_reservations WHERE document_id = $1 AND status = 'reserved' AND expires_at > now()", [documentId]);
          await client.query("COMMIT");
          return { documentId, reservationCount: Number(existing.rows[0]?.count ?? 0), alreadyReleased: true, reservedUntil: existing.rows[0]!.reservedUntil };
        }
        if (status !== "draft") throw new Error("INVALID_STATE");
        const lines = await client.query<{ id: string; productId: string; quantity: string }>("SELECT id, product_id AS \"productId\", quantity FROM stock_document_lines WHERE document_id = $1 ORDER BY id FOR UPDATE", [documentId]);
        const reservedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        let reservationCount = 0;
        for (const line of lines.rows) {
          let remaining = Number(line.quantity);
          const balances = await client.query<{ id: string; locationId: string; productId: string; lotId: string | null; serialId: string | null; available: string }>(
            `SELECT sb.id, sb.location_id AS "locationId", sb.product_id AS "productId", sb.lot_id AS "lotId", sb.serial_id AS "serialId",
                    (sb.on_hand - coalesce(r.committed, 0)) AS available
             FROM stock_balances sb
             LEFT JOIN lots lot ON lot.id = sb.lot_id
             LEFT JOIN LATERAL (
               SELECT sum(quantity) AS committed FROM stock_reservations
               WHERE stock_balance_id = sb.id AND (status = 'picked' OR (status = 'reserved' AND expires_at > now()))
             ) r ON true
             WHERE sb.warehouse_id = $1 AND sb.product_id = $2
               AND sb.on_hand > coalesce(r.committed, 0)
               AND (lot.expires_at IS NULL OR lot.expires_at >= current_date)
             ORDER BY lot.expires_at NULLS LAST, sb.created_at, sb.id
             FOR UPDATE OF sb`, [warehouseId, line.productId]);
          for (const balance of balances.rows) {
            if (remaining <= 0) break;
            const quantity = Math.min(remaining, Number(balance.available));
            await client.query(
              `INSERT INTO stock_reservations (warehouse_id, document_id, document_line_id, stock_balance_id, location_id, product_id, lot_id, serial_id, quantity, expires_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [warehouseId, documentId, line.id, balance.id, balance.locationId, balance.productId, balance.lotId, balance.serialId, quantity, reservedUntil],
            );
            reservationCount += 1;
            remaining -= quantity;
          }
          if (remaining > 0.000001) throw new Error("INSUFFICIENT_STOCK");
        }
        await client.query("UPDATE stock_documents SET status = 'ready_to_pick', updated_at = now() WHERE id = $1", [documentId]);
        await client.query("COMMIT");
        return { documentId, reservationCount, alreadyReleased: false, reservedUntil };
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    },
  };
}
