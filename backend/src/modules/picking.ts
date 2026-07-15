import type { Context, Hono } from "hono";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import { auditChange, requireAccess, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";

const scanSchema = z.object({ locationBarcode: z.string().trim().min(1).max(100), itemBarcode: z.string().trim().min(1).max(120) }).strict();

export interface PickCandidate { reservationId: string; quantity: string; locationBarcode: string; sku: string; lotCode: string | null; serialCode: string | null; scanned: string }

export function selectPickCandidate(candidates: PickCandidate[], input: { locationBarcode: string; itemBarcode: string }) {
  const atLocation = candidates.filter(row => row.locationBarcode === input.locationBarcode);
  if (!atLocation.length) throw new Error("WRONG_LOCATION");
  const match = atLocation.find(row => [row.sku, row.lotCode, row.serialCode].includes(input.itemBarcode) && Number(row.scanned) < Number(row.quantity));
  if (!match) {
    const known = atLocation.some(row => [row.sku, row.lotCode, row.serialCode].includes(input.itemBarcode));
    throw new Error(known ? "DUPLICATE_SCAN" : "WRONG_ITEM");
  }
  const firstForProduct = atLocation.find(row => row.sku === match.sku && Number(row.scanned) < Number(row.quantity));
  if (match.lotCode && firstForProduct?.reservationId !== match.reservationId) throw new Error("FEFO_DENIED");
  return match;
}

function mapError(error: unknown): never {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : error instanceof Error ? error.message : "";
  if (code === "NOT_FOUND") throw new HttpError(404, code, "Không tìm thấy phiếu soạn");
  if (["WRONG_STATE", "PICKER_CONFLICT", "INCOMPLETE_PICK"].includes(code)) throw new HttpError(409, code, "Phiếu chưa thể thực hiện thao tác này");
  if (["WRONG_LOCATION", "WRONG_ITEM", "DUPLICATE_SCAN", "FEFO_DENIED"].includes(code)) throw new HttpError(422, code, "Mã quét không khớp reservation");
  throw error;
}

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await work(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export function registerPickingRoutes(app: Hono, authStore: AuthStore, accessStore: AccessStore, pool: Pool, sessionSecret: string) {
  const actor = (c: Context) => requireAccess(c, authStore, accessStore, sessionSecret, { permission: "outbound.pick" });
  app.get("/api/picking", async c => {
    const current = await actor(c); const pagination = parsePagination(c.req.query());
    const result = await pool.query(
      `SELECT id, document_no AS "documentNo", status, picker_user_id AS "pickerUserId", version
       FROM stock_documents WHERE warehouse_id = $1 AND document_type = 'issue' AND status IN ('ready_to_pick','picking','needs_repick')
       ORDER BY created_at LIMIT $2 OFFSET $3`, [current.user.warehouseId, pagination.pageSize, pagination.offset]);
    return c.json({ data: result.rows, pagination: { page: pagination.page, pageSize: pagination.pageSize } });
  });
  app.post("/api/picking/:id/claim", async c => {
    const current = await actor(c); if (!current.user.warehouseId) throw new HttpError(403, "FORBIDDEN", "Không có kho");
    try {
      const result = await transaction(pool, async client => {
        const doc = await client.query<{ status: string; pickerUserId: string | null }>(`SELECT status, picker_user_id AS "pickerUserId" FROM stock_documents WHERE id=$1 AND warehouse_id=$2 AND document_type='issue' FOR UPDATE`, [c.req.param("id"), current.user.warehouseId]);
        const row = doc.rows[0]; if (!row) throw new Error("NOT_FOUND");
        if (row.status === "picking" && row.pickerUserId === current.user.id) return { resumed: true };
        if (row.status === "picking") throw new Error("PICKER_CONFLICT");
        if (!["ready_to_pick", "needs_repick"].includes(row.status)) throw new Error("WRONG_STATE");
        if (row.status === "needs_repick") {
          await client.query("DELETE FROM picking_scans WHERE document_id=$1", [c.req.param("id")]);
          await client.query("DELETE FROM checking_scans WHERE document_id=$1", [c.req.param("id")]);
          await client.query("UPDATE stock_reservations SET status='reserved',expires_at=now()+interval '30 minutes',updated_at=now() WHERE document_id=$1 AND status='picked'", [c.req.param("id")]);
        }
        await client.query("UPDATE stock_documents SET status='picking', picker_user_id=$2, picker_started_at=now(), version=version+1 WHERE id=$1", [c.req.param("id"), current.user.id]);
        return { resumed: false };
      });
      await auditChange(accessStore, current, { warehouseId: current.user.warehouseId, action: "picking.claim", entityType: "stock_document", entityId: c.req.param("id") });
      return c.json({ result });
    } catch (error) { mapError(error); }
  });
  app.post("/api/picking/:id/scan", async c => {
    const current = await actor(c); const input = await parseJson(c, scanSchema); if (!current.user.warehouseId) throw new HttpError(403, "FORBIDDEN", "Không có kho");
    try {
      const progress = await transaction(pool, async client => {
        const doc = await client.query<{ pickerUserId: string }>(`SELECT picker_user_id AS "pickerUserId" FROM stock_documents WHERE id=$1 AND warehouse_id=$2 AND status='picking' FOR UPDATE`, [c.req.param("id"), current.user.warehouseId]);
        if (!doc.rows[0]) throw new Error("WRONG_STATE"); if (doc.rows[0].pickerUserId !== current.user.id) throw new Error("PICKER_CONFLICT");
        await client.query("SELECT id FROM stock_reservations WHERE document_id=$1 AND status='reserved' FOR UPDATE", [c.req.param("id")]);
        const candidates = await client.query<PickCandidate>(
          `SELECT r.id AS "reservationId", r.quantity, l.barcode AS "locationBarcode", p.sku,
                  lot.lot_code AS "lotCode", serial.serial_code AS "serialCode", coalesce(sum(s.quantity),0) AS scanned
           FROM stock_reservations r JOIN locations l ON l.id=r.location_id JOIN products p ON p.id=r.product_id
           LEFT JOIN lots lot ON lot.id=r.lot_id LEFT JOIN serials serial ON serial.id=r.serial_id
           LEFT JOIN picking_scans s ON s.reservation_id=r.id
           WHERE r.document_id=$1 AND r.status='reserved'
           GROUP BY r.id,l.id,p.id,lot.id,serial.id ORDER BY lot.expires_at NULLS LAST, r.created_at`, [c.req.param("id")]);
        const match = selectPickCandidate(candidates.rows, input);
        await client.query(`INSERT INTO picking_scans (warehouse_id,document_id,reservation_id,picker_user_id,location_barcode,item_barcode) VALUES ($1,$2,$3,$4,$5,$6)`, [current.user.warehouseId,c.req.param("id"),match.reservationId,current.user.id,input.locationBarcode,input.itemBarcode]);
        const totals = await client.query<{ picked: string; required: string }>(`SELECT coalesce((SELECT sum(quantity) FROM picking_scans WHERE document_id=$1),0) AS picked, coalesce((SELECT sum(quantity) FROM stock_reservations WHERE document_id=$1 AND status='reserved'),0) AS required`, [c.req.param("id")]);
        return { picked: Number(totals.rows[0]!.picked), required: Number(totals.rows[0]!.required) };
      });
      return c.json({ progress });
    } catch (error) { mapError(error); }
  });
  app.post("/api/picking/:id/confirm", async c => {
    const current = await actor(c); if (!current.user.warehouseId) throw new HttpError(403,"FORBIDDEN","Không có kho");
    try {
      await transaction(pool, async client => {
        const doc = await client.query<{ pickerUserId: string }>(`SELECT picker_user_id AS "pickerUserId" FROM stock_documents WHERE id=$1 AND warehouse_id=$2 AND status='picking' FOR UPDATE`, [c.req.param("id"),current.user.warehouseId]);
        if (!doc.rows[0] || doc.rows[0].pickerUserId !== current.user.id) throw new Error("PICKER_CONFLICT");
        const totals = await client.query<{ complete: boolean }>(`SELECT coalesce(sum(r.quantity),0)=coalesce((SELECT sum(quantity) FROM picking_scans WHERE document_id=$1),0) AS complete FROM stock_reservations r WHERE r.document_id=$1 AND r.status='reserved'`, [c.req.param("id")]);
        if (!totals.rows[0]?.complete) throw new Error("INCOMPLETE_PICK");
        await client.query("UPDATE stock_reservations SET status='picked', expires_at=NULL, updated_at=now() WHERE document_id=$1 AND status='reserved'", [c.req.param("id")]);
        await client.query("UPDATE stock_documents SET status='picked', picked_at=now(), version=version+1, updated_at=now() WHERE id=$1", [c.req.param("id")]);
      });
      await auditChange(accessStore,current,{warehouseId:current.user.warehouseId,action:"picking.confirm",entityType:"stock_document",entityId:c.req.param("id")});
      return c.json({ result: { status: "picked" } });
    } catch (error) { mapError(error); }
  });
}
