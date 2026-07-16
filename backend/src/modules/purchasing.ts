import type { Context, Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import { auditChange, requireAccess, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { routePermissionCatalog, type PermissionCode } from "./permissions.js";
import { validateReceiptLine } from "./receipts.js";
import { postStockLines } from "./stock.js";

const createSchema = z.object({
  orderNo: z.string().trim().min(1).max(80),
  supplierId: z.string().uuid(),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
  })).min(1).max(200),
}).strict();

const receiveSchema = z.object({
  documentNo: z.string().trim().min(1).max(80),
  lines: z.array(z.object({
    poLineId: z.string().uuid(),
    locationId: z.string().uuid(),
    quantity: z.number().positive(),
    lotCode: z.string().optional(),
    serialCode: z.string().optional(),
    manufacturedAt: z.string().date().optional(),
    expiresAt: z.string().date().optional(),
  })).min(1).max(200),
}).strict();

function mapPurchasingError(error: unknown): never {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : error instanceof Error ? error.message : "";
  if (code === "NOT_FOUND") throw new HttpError(404, code, "Không tìm thấy PO");
  if (["INVALID_STATE", "OVER_RECEIPT"].includes(code)) {
    throw new HttpError(409, code, "PO không thể nhận số lượng này");
  }
  if (code === "SCOPE_NOT_FOUND") {
    throw new HttpError(422, code, "Supplier, product hoặc location không thuộc kho");
  }
  if (["23505", "DUPLICATE_RECEIPT"].includes(code)) {
    throw new HttpError(409, "DUPLICATE", "Số PO/receipt đã tồn tại");
  }
  throw error;
}

function actorFor(c: Context, auth: AuthStore, access: AccessStore, secret: string, permission: PermissionCode) {
  return requireAccess(c, auth, access, secret, { permission });
}

export function registerPurchasingRoutes(
  app: Hono,
  auth: AuthStore,
  access: AccessStore,
  pool: Pool,
  secret: string,
) {
  app.get("/api/purchase-orders", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["GET /api/purchase-orders"]);
    const page = parsePagination(c.req.query());
    const result = await pool.query(
      `SELECT po.id,po.order_no AS "orderNo",po.status,partner.name AS "supplierName",
        count(l.id)::int AS "lineCount",
        coalesce(sum(l.ordered_quantity-l.received_quantity),0)::float8 AS "outstandingQuantity"
       FROM purchase_orders po
       JOIN partners partner ON partner.id=po.supplier_id
       LEFT JOIN purchase_order_lines l ON l.purchase_order_id=po.id
       WHERE po.warehouse_id=$1
       GROUP BY po.id,partner.id ORDER BY po.created_at DESC LIMIT $2 OFFSET $3`,
      [actor.user.warehouseId, page.pageSize, page.offset],
    );
    return c.json({ data: result.rows });
  });

  app.post("/api/purchase-orders", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["POST /api/purchase-orders"]);
    const input = await parseJson(c, createSchema);
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const supplier = await db.query(
        "SELECT 1 FROM partners WHERE id=$1 AND warehouse_id=$2 AND kind='supplier' AND status='active'",
        [input.supplierId, actor.user.warehouseId],
      );
      if (!supplier.rowCount) throw new Error("SCOPE_NOT_FOUND");

      const purchaseOrder = await db.query<{ id: string }>(
        `INSERT INTO purchase_orders(warehouse_id,supplier_id,order_no,created_by)
         VALUES($1,$2,$3,$4) RETURNING id`,
        [actor.user.warehouseId, input.supplierId, input.orderNo, actor.user.id],
      );
      for (const line of input.lines) {
        const product = await db.query(
          "SELECT 1 FROM products WHERE id=$1 AND warehouse_id=$2 AND status='active'",
          [line.productId, actor.user.warehouseId],
        );
        if (!product.rowCount) throw new Error("SCOPE_NOT_FOUND");
        await db.query(
          `INSERT INTO purchase_order_lines(purchase_order_id,product_id,ordered_quantity)
           VALUES($1,$2,$3)`,
          [purchaseOrder.rows[0]!.id, line.productId, line.quantity],
        );
      }
      await db.query("COMMIT");
      await auditChange(access, actor, {
        warehouseId: actor.user.warehouseId,
        action: "purchasing.create",
        entityType: "purchase_order",
        entityId: purchaseOrder.rows[0]!.id,
      });
      return c.json({ purchaseOrder: { id: purchaseOrder.rows[0]!.id, status: "draft" } }, 201);
    } catch (error) {
      await db.query("ROLLBACK");
      mapPurchasingError(error);
    } finally {
      db.release();
    }
  });

  app.post("/api/purchase-orders/:id/approve", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["POST /api/purchase-orders/:id/approve"]);
    const result = await pool.query(
      `UPDATE purchase_orders SET status='approved',approved_at=now(),updated_at=now()
       WHERE id=$1 AND warehouse_id=$2 AND status='draft' RETURNING id`,
      [c.req.param("id"), actor.user.warehouseId],
    );
    if (!result.rowCount) {
      throw new HttpError(409, "INVALID_STATE", "PO không ở trạng thái draft");
    }
    await auditChange(access, actor, {
      warehouseId: actor.user.warehouseId,
      action: "purchasing.approve",
      entityType: "purchase_order",
      entityId: c.req.param("id"),
    });
    return c.json({ result: { status: "approved" } });
  });

  app.post("/api/purchase-orders/:id/receive", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["POST /api/purchase-orders/:id/receive"]);
    const input = await parseJson(c, receiveSchema);
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const purchaseOrder = await db.query<{ status: string }>(
        "SELECT status FROM purchase_orders WHERE id=$1 AND warehouse_id=$2 FOR UPDATE",
        [c.req.param("id"), actor.user.warehouseId],
      );
      if (!purchaseOrder.rows[0]) throw new Error("NOT_FOUND");
      if (purchaseOrder.rows[0].status !== "approved") throw new Error("INVALID_STATE");

      const existing = await db.query<{ id: string; belongsToOrder: boolean }>(
        `SELECT document.id,
          EXISTS(
            SELECT 1 FROM purchase_receipt_lines receipt_line
            JOIN purchase_order_lines po_line ON po_line.id=receipt_line.purchase_order_line_id
            WHERE receipt_line.receipt_document_id=document.id AND po_line.purchase_order_id=$3
          ) AS "belongsToOrder"
         FROM stock_documents document
         WHERE document.warehouse_id=$1 AND document.document_no=$2`,
        [actor.user.warehouseId, input.documentNo, c.req.param("id")],
      );
      if (existing.rows[0]) {
        if (!existing.rows[0].belongsToOrder) throw new Error("DUPLICATE_RECEIPT");
        await db.query("COMMIT");
        return c.json({ result: { receiptId: existing.rows[0].id, alreadyReceived: true } });
      }

      const document = await db.query<{ id: string }>(
        `INSERT INTO stock_documents(warehouse_id,document_no,document_type,status,created_by)
         VALUES($1,$2,'receipt','draft',$3) RETURNING id`,
        [actor.user.warehouseId, input.documentNo, actor.user.id],
      );
      const moves = [];
      for (const line of input.lines) {
        const purchaseLine = await db.query<{
          productId: string;
          outstanding: string;
          trackingMode: "none" | "lot" | "serial";
          expiryManaged: boolean;
        }>(
          `SELECT pol.product_id AS "productId",
            pol.ordered_quantity-pol.received_quantity AS outstanding,
            p.tracking_mode AS "trackingMode",p.expiry_managed AS "expiryManaged"
           FROM purchase_order_lines pol
           JOIN products p ON p.id=pol.product_id
           JOIN locations location ON location.id=$4 AND location.warehouse_id=$3 AND location.status='active'
           WHERE pol.id=$1 AND pol.purchase_order_id=$2 FOR UPDATE OF pol`,
          [line.poLineId, c.req.param("id"), actor.user.warehouseId, line.locationId],
        );
        const source = purchaseLine.rows[0];
        if (!source) throw new Error("SCOPE_NOT_FOUND");
        if (line.quantity > Number(source.outstanding)) throw new Error("OVER_RECEIPT");
        validateReceiptLine(source, line);
        await db.query(
          `INSERT INTO stock_document_lines(document_id,location_id,product_id,quantity,snapshot)
           VALUES($1,$2,$3,$4,$5)`,
          [document.rows[0]!.id, line.locationId, source.productId, line.quantity, {
            lotCode: line.lotCode ?? null,
            serialCode: line.serialCode ?? null,
            manufacturedAt: line.manufacturedAt ?? null,
            expiresAt: line.expiresAt ?? null,
            poLineId: line.poLineId,
          }],
        );
        await db.query(
          `INSERT INTO purchase_receipt_lines(receipt_document_id,purchase_order_line_id,quantity)
           VALUES($1,$2,$3)`,
          [document.rows[0]!.id, line.poLineId, line.quantity],
        );
        await db.query(
          "UPDATE purchase_order_lines SET received_quantity=received_quantity+$2 WHERE id=$1",
          [line.poLineId, line.quantity],
        );
        moves.push({
          locationId: line.locationId,
          productId: source.productId,
          quantityDelta: line.quantity,
          lotCode: line.lotCode ?? null,
          serialCode: line.serialCode ?? null,
          manufacturedAt: line.manufacturedAt ?? null,
          expiresAt: line.expiresAt ?? null,
        });
      }
      await postStockLines(db, {
        warehouseId: actor.user.warehouseId!,
        documentId: document.rows[0]!.id,
        lines: moves,
      });
      await db.query(
        "UPDATE stock_documents SET status='confirmed',confirmed_at=now(),updated_at=now() WHERE id=$1",
        [document.rows[0]!.id],
      );
      await db.query(
        `UPDATE purchase_orders SET status='closed',updated_at=now()
         WHERE id=$1 AND NOT EXISTS(
           SELECT 1 FROM purchase_order_lines
           WHERE purchase_order_id=$1 AND received_quantity<ordered_quantity
         )`,
        [c.req.param("id")],
      );
      await db.query("COMMIT");
      await auditChange(access, actor, {
        warehouseId: actor.user.warehouseId,
        action: "purchasing.receive",
        entityType: "purchase_order",
        entityId: c.req.param("id"),
        metadata: { receiptId: document.rows[0]!.id },
      });
      return c.json({ result: { receiptId: document.rows[0]!.id, alreadyReceived: false } });
    } catch (error) {
      await db.query("ROLLBACK");
      mapPurchasingError(error);
    } finally {
      db.release();
    }
  });
}
