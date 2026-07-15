import type { Context, Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import { auditChange, requireAccess, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { postStockLines } from "./stock.js";

export function returnDelta(kind: "customer" | "supplier", quantity: number) {
  return kind === "customer" ? quantity : -quantity;
}

export function remainingReturnQuantity(original: number, claimed: number) {
  return Math.max(0, original - claimed);
}

const createSchema = z.object({
  returnNo: z.string().trim().min(1).max(80),
  kind: z.enum(["customer", "supplier"]),
  originalDocumentId: z.string().uuid(),
  lines: z.array(z.object({
    originalMovementId: z.string().uuid(),
    quantity: z.number().positive(),
  })).min(1).max(200),
}).strict();

function mapReturnError(error: unknown): never {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : error instanceof Error ? error.message : "";
  if (code === "NOT_FOUND") throw new HttpError(404, code, "Không tìm thấy chứng từ gốc");
  if (code === "OVER_RETURN") throw new HttpError(409, code, "Số lượng trả vượt chứng từ gốc");
  if (code === "INVALID_STATE") throw new HttpError(409, code, "Phiếu trả không ở draft");
  if (code === "23505") throw new HttpError(409, "DUPLICATE", "Số phiếu hoặc dòng trả đã tồn tại");
  throw error;
}

function actorFor(c: Context, auth: AuthStore, access: AccessStore, secret: string) {
  return requireAccess(c, auth, access, secret, { permission: "stock.manage" });
}

export function registerReturnRoutes(
  app: Hono,
  auth: AuthStore,
  access: AccessStore,
  pool: Pool,
  secret: string,
) {
  app.get("/api/returns", async (c) => {
    const actor = await actorFor(c, auth, access, secret);
    const page = parsePagination(c.req.query());
    const result = await pool.query(
      `SELECT r.id,r.return_no AS "returnNo",r.kind,r.status,
        o.document_no AS "originalDocumentNo",count(l.id)::int AS "lineCount"
       FROM stock_returns r
       JOIN stock_documents o ON o.id=r.original_document_id
       LEFT JOIN stock_return_lines l ON l.return_id=r.id
       WHERE r.warehouse_id=$1
       GROUP BY r.id,o.id ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
      [actor.user.warehouseId, page.pageSize, page.offset],
    );
    return c.json({ data: result.rows });
  });

  app.post("/api/returns", async (c) => {
    const actor = await actorFor(c, auth, access, secret);
    const input = await parseJson(c, createSchema);
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const expectedType = input.kind === "customer" ? "issue" : "receipt";
      const original = await db.query(
        `SELECT 1 FROM stock_documents
         WHERE id=$1 AND warehouse_id=$2 AND document_type=$3 AND status IN('confirmed','shipped')`,
        [input.originalDocumentId, actor.user.warehouseId, expectedType],
      );
      if (!original.rowCount) throw new Error("NOT_FOUND");

      const stockReturn = await db.query<{ id: string }>(
        `INSERT INTO stock_returns(warehouse_id,return_no,kind,original_document_id,created_by)
         VALUES($1,$2,$3,$4,$5) RETURNING id`,
        [actor.user.warehouseId, input.returnNo, input.kind, input.originalDocumentId, actor.user.id],
      );
      for (const line of input.lines) {
        const movement = await db.query<{ quantity: string; claimed: string }>(
          `SELECT abs(m.quantity_delta) AS quantity,
            coalesce((
              SELECT sum(rl.quantity)
              FROM stock_return_lines rl
              JOIN stock_returns sr ON sr.id=rl.return_id
              WHERE rl.original_movement_id=m.id AND sr.status IN('draft','confirmed')
            ),0) AS claimed
           FROM stock_movements m
           WHERE m.id=$1 AND m.document_id=$2 AND m.warehouse_id=$3
           FOR UPDATE OF m`,
          [line.originalMovementId, input.originalDocumentId, actor.user.warehouseId],
        );
        const source = movement.rows[0];
        if (!source) throw new Error("NOT_FOUND");
        if (line.quantity > remainingReturnQuantity(Number(source.quantity), Number(source.claimed))) {
          throw new Error("OVER_RETURN");
        }
        await db.query(
          `INSERT INTO stock_return_lines(return_id,original_movement_id,quantity)
           VALUES($1,$2,$3)`,
          [stockReturn.rows[0]!.id, line.originalMovementId, line.quantity],
        );
      }
      await db.query("COMMIT");
      return c.json({ return: { id: stockReturn.rows[0]!.id, status: "draft" } }, 201);
    } catch (error) {
      await db.query("ROLLBACK");
      mapReturnError(error);
    } finally {
      db.release();
    }
  });

  app.post("/api/returns/:id/confirm", async (c) => {
    const actor = await actorFor(c, auth, access, secret);
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const stockReturn = await db.query<{
        status: string;
        kind: "customer" | "supplier";
        returnNo: string;
        documentId: string | null;
      }>(
        `SELECT status,kind,return_no AS "returnNo",return_document_id AS "documentId"
         FROM stock_returns WHERE id=$1 AND warehouse_id=$2 FOR UPDATE`,
        [c.req.param("id"), actor.user.warehouseId],
      );
      const current = stockReturn.rows[0];
      if (!current) throw new Error("NOT_FOUND");
      if (current.status === "confirmed") {
        await db.query("COMMIT");
        return c.json({ result: { documentId: current.documentId, alreadyConfirmed: true } });
      }
      if (current.status !== "draft") throw new Error("INVALID_STATE");

      const document = await db.query<{ id: string }>(
        `INSERT INTO stock_documents(warehouse_id,document_no,document_type,status,created_by)
         VALUES($1,$2,$3,'draft',$4) RETURNING id`,
        [
          actor.user.warehouseId,
          current.returnNo,
          current.kind === "customer" ? "return_customer" : "return_supplier",
          actor.user.id,
        ],
      );
      const lines = await db.query<{
        locationId: string;
        productId: string;
        lotCode: string | null;
        serialCode: string | null;
        quantity: string;
      }>(
        `SELECT m.location_id AS "locationId",m.product_id AS "productId",
          lot.lot_code AS "lotCode",serial.serial_code AS "serialCode",rl.quantity
         FROM stock_return_lines rl
         JOIN stock_movements m ON m.id=rl.original_movement_id
         LEFT JOIN lots lot ON lot.id=m.lot_id
         LEFT JOIN serials serial ON serial.id=m.serial_id
         WHERE rl.return_id=$1 FOR UPDATE OF rl`,
        [c.req.param("id")],
      );
      await postStockLines(db, {
        warehouseId: actor.user.warehouseId!,
        documentId: document.rows[0]!.id,
        lines: lines.rows.map((line) => ({
          locationId: line.locationId,
          productId: line.productId,
          quantityDelta: returnDelta(current.kind, Number(line.quantity)),
          lotCode: line.lotCode,
          serialCode: line.serialCode,
        })),
      });
      await db.query("UPDATE stock_documents SET status='confirmed',confirmed_at=now() WHERE id=$1", [document.rows[0]!.id]);
      await db.query(
        "UPDATE stock_returns SET status='confirmed',return_document_id=$2,confirmed_at=now() WHERE id=$1",
        [c.req.param("id"), document.rows[0]!.id],
      );
      await db.query("COMMIT");
      await auditChange(access, actor, {
        warehouseId: actor.user.warehouseId,
        action: "returns.confirm",
        entityType: "stock_return",
        entityId: c.req.param("id"),
      });
      return c.json({ result: { documentId: document.rows[0]!.id, alreadyConfirmed: false } });
    } catch (error) {
      await db.query("ROLLBACK");
      mapReturnError(error);
    } finally {
      db.release();
    }
  });
}
