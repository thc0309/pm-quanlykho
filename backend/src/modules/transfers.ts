import type { Context, Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import { auditChange, requireAccess, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { routePermissionCatalog, type PermissionCode } from "./permissions.js";
import { postStockLines } from "./stock.js";

export function transferReconciliation(source: number, inTransit: number, destination: number) {
  return source + inTransit + destination;
}

export function hasExactTransferLineSet(expected: string[], received: string[]) {
  const receivedSet = new Set(received);
  return receivedSet.size === expected.length
    && expected.length === received.length
    && expected.every((id) => receivedSet.has(id));
}

export function aggregateTransferLines(lines: Array<{ stockBalanceId: string; quantity: number }>) {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(line.stockBalanceId, (quantities.get(line.stockBalanceId) ?? 0) + line.quantity);
  }
  return [...quantities].map(([stockBalanceId, quantity]) => ({ stockBalanceId, quantity }));
}

const createSchema = z.object({
  transferNo: z.string().trim().min(1).max(80),
  targetWarehouseId: z.string().uuid(),
  lines: z.array(z.object({
    stockBalanceId: z.string().uuid(),
    quantity: z.number().positive(),
  })).min(1).max(200),
}).strict();

const receiveSchema = z.object({
  lines: z.array(z.object({
    transferLineId: z.string().uuid(),
    targetLocationId: z.string().uuid(),
  })).min(1).max(200),
}).strict();

function mapTransferError(error: unknown): never {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : error instanceof Error ? error.message : "";
  if (code === "NOT_FOUND") throw new HttpError(404, code, "Không tìm thấy transfer");
  if (["INVALID_STATE", "INSUFFICIENT_STOCK"].includes(code)) {
    throw new HttpError(409, code, "Transfer không thể thực hiện");
  }
  if (code === "SCOPE_NOT_FOUND") {
    throw new HttpError(422, code, "Kho, sản phẩm hoặc vị trí không hợp lệ");
  }
  if (code === "23505") throw new HttpError(409, "DUPLICATE", "Số transfer đã tồn tại");
  throw error;
}

function actorFor(c: Context, auth: AuthStore, access: AccessStore, secret: string, permission: PermissionCode) {
  return requireAccess(c, auth, access, secret, { permission });
}

export function registerTransferRoutes(
  app: Hono,
  auth: AuthStore,
  access: AccessStore,
  pool: Pool,
  secret: string,
) {
  app.get("/api/transfers", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["GET /api/transfers"]);
    const page = parsePagination(c.req.query());
    const result = await pool.query(
      `SELECT t.id,t.transfer_no AS "transferNo",t.status,
        sw.code AS "sourceWarehouse",tw.code AS "targetWarehouse",
        count(l.id)::int AS "lineCount",coalesce(sum(l.quantity),0)::float8 AS quantity
       FROM warehouse_transfers t
       JOIN warehouses sw ON sw.id=t.source_warehouse_id
       JOIN warehouses tw ON tw.id=t.target_warehouse_id
       LEFT JOIN warehouse_transfer_lines l ON l.transfer_id=t.id
       WHERE t.source_warehouse_id=$1 OR t.target_warehouse_id=$1
       GROUP BY t.id,sw.id,tw.id
       ORDER BY t.created_at DESC LIMIT $2 OFFSET $3`,
      [actor.user.warehouseId, page.pageSize, page.offset],
    );
    return c.json({ data: result.rows });
  });

  app.post("/api/transfers", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["POST /api/transfers"]);
    const input = await parseJson(c, createSchema);
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      if (input.targetWarehouseId === actor.user.warehouseId) throw new Error("SCOPE_NOT_FOUND");
      const transfer = await db.query<{ id: string }>(
        `INSERT INTO warehouse_transfers(transfer_no,source_warehouse_id,target_warehouse_id,created_by)
         SELECT $1,$2,id,$3 FROM warehouses WHERE id=$4 AND status='active' RETURNING id`,
        [input.transferNo, actor.user.warehouseId, actor.user.id, input.targetWarehouseId],
      );
      if (!transfer.rows[0]) throw new Error("SCOPE_NOT_FOUND");

      for (const line of aggregateTransferLines(input.lines)) {
        const balance = await db.query<{
          sourceProductId: string;
          sourceLocationId: string;
          sku: string;
          lotCode: string | null;
          serialCode: string | null;
          manufacturedAt: string | null;
          expiresAt: string | null;
          available: string;
        }>(
          `SELECT sb.product_id AS "sourceProductId",sb.location_id AS "sourceLocationId",p.sku,
            lot.lot_code AS "lotCode",serial.serial_code AS "serialCode",
            lot.manufactured_at AS "manufacturedAt",lot.expires_at AS "expiresAt",
            sb.on_hand-coalesce((
              SELECT sum(quantity) FROM stock_reservations
              WHERE stock_balance_id=sb.id
                AND (status='picked' OR (status='reserved' AND expires_at>now()))
            ),0) AS available
           FROM stock_balances sb
           JOIN products p ON p.id=sb.product_id
           LEFT JOIN lots lot ON lot.id=sb.lot_id
           LEFT JOIN serials serial ON serial.id=sb.serial_id
           WHERE sb.id=$1 AND sb.warehouse_id=$2 FOR UPDATE OF sb`,
          [line.stockBalanceId, actor.user.warehouseId],
        );
        const source = balance.rows[0];
        if (!source) throw new Error("SCOPE_NOT_FOUND");
        if (line.quantity > Number(source.available)) throw new Error("INSUFFICIENT_STOCK");
        const targetProduct = await db.query<{ id: string }>(
          "SELECT id FROM products WHERE warehouse_id=$1 AND sku=$2 AND status='active'",
          [input.targetWarehouseId, source.sku],
        );
        if (!targetProduct.rows[0]) throw new Error("SCOPE_NOT_FOUND");
        await db.query(
          `INSERT INTO warehouse_transfer_lines(
            transfer_id,source_balance_id,source_product_id,target_product_id,source_location_id,
            lot_code,serial_code,manufactured_at,expires_at,quantity
          ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            transfer.rows[0].id,
            line.stockBalanceId,
            source.sourceProductId,
            targetProduct.rows[0].id,
            source.sourceLocationId,
            source.lotCode,
            source.serialCode,
            source.manufacturedAt,
            source.expiresAt,
            line.quantity,
          ],
        );
      }
      await db.query("COMMIT");
      return c.json({ transfer: { id: transfer.rows[0].id, status: "draft" } }, 201);
    } catch (error) {
      await db.query("ROLLBACK");
      mapTransferError(error);
    } finally {
      db.release();
    }
  });

  app.post("/api/transfers/:id/dispatch", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["POST /api/transfers/:id/dispatch"]);
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const transfer = await db.query<{ status: string; transferNo: string }>(
        `SELECT status,transfer_no AS "transferNo" FROM warehouse_transfers
         WHERE id=$1 AND source_warehouse_id=$2 FOR UPDATE`,
        [c.req.param("id"), actor.user.warehouseId],
      );
      const current = transfer.rows[0];
      if (!current) throw new Error("NOT_FOUND");
      if (current.status === "in_transit") {
        await db.query("COMMIT");
        return c.json({ result: { alreadyDispatched: true } });
      }
      if (current.status !== "draft") throw new Error("INVALID_STATE");

      const document = await db.query<{ id: string }>(
        `INSERT INTO stock_documents(warehouse_id,document_no,document_type,status,created_by)
         VALUES($1,$2||'-OUT','transfer_out','draft',$3) RETURNING id`,
        [actor.user.warehouseId, current.transferNo, actor.user.id],
      );
      const lines = await db.query<{
        locationId: string;
        productId: string;
        quantity: string;
        lotCode: string | null;
        serialCode: string | null;
      }>(
        `SELECT source_location_id AS "locationId",source_product_id AS "productId",quantity,
          lot_code AS "lotCode",serial_code AS "serialCode"
         FROM warehouse_transfer_lines WHERE transfer_id=$1 FOR UPDATE`,
        [c.req.param("id")],
      );
      await postStockLines(db, {
        warehouseId: actor.user.warehouseId!,
        documentId: document.rows[0]!.id,
        lines: lines.rows.map((line) => ({
          locationId: line.locationId,
          productId: line.productId,
          quantityDelta: -Number(line.quantity),
          lotCode: line.lotCode,
          serialCode: line.serialCode,
        })),
      });
      await db.query("UPDATE stock_documents SET status='confirmed',confirmed_at=now() WHERE id=$1", [document.rows[0]!.id]);
      await db.query(
        "UPDATE warehouse_transfers SET status='in_transit',out_document_id=$2,dispatched_at=now() WHERE id=$1",
        [c.req.param("id"), document.rows[0]!.id],
      );
      await db.query("COMMIT");
      return c.json({ result: { alreadyDispatched: false } });
    } catch (error) {
      await db.query("ROLLBACK");
      mapTransferError(error);
    } finally {
      db.release();
    }
  });

  app.post("/api/transfers/:id/receive", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["POST /api/transfers/:id/receive"]);
    const input = await parseJson(c, receiveSchema);
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const transfer = await db.query<{ status: string; transferNo: string; documentId: string | null }>(
        `SELECT status,transfer_no AS "transferNo",in_document_id AS "documentId"
         FROM warehouse_transfers WHERE id=$1 AND target_warehouse_id=$2 FOR UPDATE`,
        [c.req.param("id"), actor.user.warehouseId],
      );
      const current = transfer.rows[0];
      if (!current) throw new Error("NOT_FOUND");
      if (current.status === "received") {
        await db.query("COMMIT");
        return c.json({ result: { alreadyReceived: true } });
      }
      if (current.status !== "in_transit") throw new Error("INVALID_STATE");

      const transferLines = await db.query<{
        id: string;
        productId: string;
        quantity: string;
        lotCode: string | null;
        serialCode: string | null;
        manufacturedAt: string | null;
        expiresAt: string | null;
      }>(
        `SELECT id,target_product_id AS "productId",quantity,lot_code AS "lotCode",
          serial_code AS "serialCode",manufactured_at AS "manufacturedAt",expires_at AS "expiresAt"
         FROM warehouse_transfer_lines WHERE transfer_id=$1 FOR UPDATE`,
        [c.req.param("id")],
      );
      if (!hasExactTransferLineSet(
        transferLines.rows.map((line) => line.id),
        input.lines.map((line) => line.transferLineId),
      )) throw new Error("SCOPE_NOT_FOUND");

      const locationIds = [...new Set(input.lines.map((line) => line.targetLocationId))];
      const locations = await db.query<{ id: string }>(
        "SELECT id FROM locations WHERE warehouse_id=$1 AND status='active' AND id=ANY($2::uuid[])",
        [actor.user.warehouseId, locationIds],
      );
      if (locations.rows.length !== locationIds.length) throw new Error("SCOPE_NOT_FOUND");

      const document = await db.query<{ id: string }>(
        `INSERT INTO stock_documents(warehouse_id,document_no,document_type,status,created_by)
         VALUES($1,$2||'-IN','transfer_in','draft',$3) RETURNING id`,
        [actor.user.warehouseId, current.transferNo, actor.user.id],
      );
      const byId = new Map(transferLines.rows.map((line) => [line.id, line]));
      const moves = input.lines.map((received) => {
        const line = byId.get(received.transferLineId)!;
        return {
          lineId: line.id,
          locationId: received.targetLocationId,
          productId: line.productId,
          quantityDelta: Number(line.quantity),
          lotCode: line.lotCode,
          serialCode: line.serialCode,
          manufacturedAt: line.manufacturedAt,
          expiresAt: line.expiresAt,
        };
      });
      for (const move of moves) {
        await db.query(
          "UPDATE warehouse_transfer_lines SET target_location_id=$2 WHERE id=$1",
          [move.lineId, move.locationId],
        );
      }
      await postStockLines(db, {
        warehouseId: actor.user.warehouseId!,
        documentId: document.rows[0]!.id,
        lines: moves.map((move) => ({
          locationId: move.locationId,
          productId: move.productId,
          quantityDelta: move.quantityDelta,
          lotCode: move.lotCode,
          serialCode: move.serialCode,
          manufacturedAt: move.manufacturedAt,
          expiresAt: move.expiresAt,
        })),
      });
      await db.query("UPDATE stock_documents SET status='confirmed',confirmed_at=now() WHERE id=$1", [document.rows[0]!.id]);
      await db.query(
        "UPDATE warehouse_transfers SET status='received',in_document_id=$2,received_at=now() WHERE id=$1",
        [c.req.param("id"), document.rows[0]!.id],
      );
      await db.query("COMMIT");
      await auditChange(access, actor, {
        warehouseId: actor.user.warehouseId,
        action: "transfer.receive",
        entityType: "warehouse_transfer",
        entityId: c.req.param("id"),
      });
      return c.json({ result: { alreadyReceived: false } });
    } catch (error) {
      await db.query("ROLLBACK");
      mapTransferError(error);
    } finally {
      db.release();
    }
  });

  app.post("/api/transfers/:id/cancel", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["POST /api/transfers/:id/cancel"]);
    const result = await pool.query(
      `UPDATE warehouse_transfers SET status='cancelled'
       WHERE id=$1 AND source_warehouse_id=$2 AND status='draft' RETURNING id`,
      [c.req.param("id"), actor.user.warehouseId],
    );
    if (!result.rowCount) {
      throw new HttpError(409, "INVALID_STATE", "Chỉ hủy được transfer draft");
    }
    return c.json({ result: { status: "cancelled" } });
  });
}
