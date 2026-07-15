import type { Context, Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import { auditChange, requireAccess, type AccessActor, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { postStockLines } from "./stock.js";

type Page<T> = { data: T[]; total: number };
type TrackingMode = "none" | "lot" | "serial";

export interface ReceiptLineInput {
  locationId: string;
  productId: string;
  quantity: number;
  lotCode?: string;
  serialCode?: string;
  manufacturedAt?: string;
  expiresAt?: string;
}

export interface ReceiptInput {
  warehouseId: string;
  documentNo: string;
  createdByUserId: string;
  lines: ReceiptLineInput[];
}

export interface Receipt {
  id: string;
  warehouseId: string;
  documentNo: string;
  status: "draft" | "confirmed" | "cancelled" | "reversed";
  lineCount: number;
  confirmedAt: string | null;
  createdAt: string;
}

export interface ReceiptStore {
  defaultWarehouseId(): Promise<string | null>;
  createReceipt(input: ReceiptInput): Promise<Receipt>;
  listReceipts(warehouseId: string | null, limit: number, offset: number): Promise<Page<Receipt>>;
  confirmReceipt(warehouseId: string, receiptId: string): Promise<{
    documentId: string;
    movementCount: number;
    alreadyConfirmed: boolean;
  }>;
}

const lineSchema = z.object({
  locationId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive().finite(),
  lotCode: z.string().trim().min(1).max(120).optional(),
  serialCode: z.string().trim().min(1).max(120).optional(),
  manufacturedAt: z.string().date().optional(),
  expiresAt: z.string().date().optional(),
}).strict();

const receiptSchema = z.object({
  documentNo: z.string().trim().min(1).max(80),
  lines: z.array(lineSchema).min(1).max(200),
}).strict();

function ruleError(code: string): never {
  throw new Error(code);
}

export function validateReceiptLine(
  policy: { trackingMode: TrackingMode; expiryManaged: boolean },
  line: Pick<ReceiptLineInput, "quantity" | "lotCode" | "serialCode" | "manufacturedAt" | "expiresAt">,
) {
  if (policy.trackingMode === "none" && (line.lotCode || line.serialCode)) ruleError("TRACKING_MISMATCH");
  if (policy.trackingMode === "lot" && !line.lotCode) ruleError("LOT_REQUIRED");
  if (policy.trackingMode === "lot" && line.serialCode) ruleError("TRACKING_MISMATCH");
  if (policy.trackingMode === "serial" && !line.serialCode) ruleError("SERIAL_REQUIRED");
  if (policy.trackingMode === "serial" && (line.lotCode || line.quantity !== 1)) {
    ruleError(line.quantity !== 1 ? "SERIAL_QUANTITY" : "TRACKING_MISMATCH");
  }
  if (policy.expiryManaged && !line.expiresAt) ruleError("EXPIRY_REQUIRED");
  if (line.manufacturedAt && line.expiresAt && line.manufacturedAt > line.expiresAt) ruleError("INVALID_DATES");
}

async function warehouseFor(context: Context, actor: AccessActor, store: ReceiptStore) {
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

function receiptError(error: unknown): never {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : error instanceof Error ? error.message : null;
  if (code === "RECEIPT_NOT_FOUND" || code === "SCOPE_NOT_FOUND") {
    throw new HttpError(404, "NOT_FOUND", "Không tìm thấy phiếu, sản phẩm hoặc vị trí trong kho");
  }
  if (code === "INVALID_STATE") throw new HttpError(409, "INVALID_STATE", "Phiếu nhập không còn ở trạng thái nháp");
  if (["TRACKING_MISMATCH", "LOT_REQUIRED", "SERIAL_REQUIRED", "SERIAL_QUANTITY", "EXPIRY_REQUIRED", "INVALID_DATES"].includes(code ?? "")) {
    throw new HttpError(422, code!, "Dòng phiếu nhập không đúng chính sách tracking hoặc hạn dùng");
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    throw new HttpError(409, "DUPLICATE", "Số phiếu hoặc serial đã tồn tại");
  }
  throw error;
}

function pageResponse(data: Page<Receipt>, page: number, pageSize: number) {
  return {
    data: data.data,
    pagination: { page, pageSize, totalItems: data.total, totalPages: Math.ceil(data.total / pageSize) },
  };
}

export function registerReceiptRoutes(
  app: Hono,
  authStore: AuthStore,
  accessStore: AccessStore,
  store: ReceiptStore,
  sessionSecret: string,
) {
  const actor = (context: Context) =>
    requireAccess(context, authStore, accessStore, sessionSecret, { permission: "stock.manage" });

  app.get("/api/receipts", async (c) => {
    const current = await actor(c);
    const pagination = parsePagination(c.req.query());
    const result = await store.listReceipts(warehouseScopeFor(c, current), pagination.pageSize, pagination.offset);
    return c.json(pageResponse(result, pagination.page, pagination.pageSize));
  });

  app.post("/api/receipts", async (c) => {
    const current = await actor(c);
    const warehouseId = await warehouseFor(c, current, store);
    const input = await parseJson(c, receiptSchema);
    let receipt: Receipt;
    try {
      receipt = await store.createReceipt({ ...input, warehouseId, createdByUserId: current.user.id });
    } catch (error) {
      receiptError(error);
    }
    await auditChange(accessStore, current, {
      warehouseId,
      action: "receipts.create",
      entityType: "stock_document",
      entityId: receipt!.id,
    });
    return c.json({ receipt: receipt! }, 201);
  });

  app.post("/api/receipts/:id/confirm", async (c) => {
    const current = await actor(c);
    const warehouseId = await warehouseFor(c, current, store);
    const receiptId = z.string().uuid().parse(c.req.param("id"));
    let result: Awaited<ReturnType<ReceiptStore["confirmReceipt"]>>;
    try {
      result = await store.confirmReceipt(warehouseId, receiptId);
    } catch (error) {
      receiptError(error);
    }
    if (!result!.alreadyConfirmed) {
      await auditChange(accessStore, current, {
        warehouseId,
        action: "receipts.confirm",
        entityType: "stock_document",
        entityId: receiptId,
        metadata: { movementCount: result!.movementCount },
      });
    }
    return c.json({ result: result! });
  });
}

export function createPostgresReceiptStore(pool: Pool): ReceiptStore {
  return {
    async defaultWarehouseId() {
      const result = await pool.query<{ id: string }>(`SELECT id FROM warehouses ORDER BY code LIMIT 2`);
      return result.rows.length === 1 ? result.rows[0]!.id : null;
    },
    async createReceipt(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const document = await client.query<{ id: string; createdAt: string }>(
          `INSERT INTO stock_documents (warehouse_id, document_no, document_type, status, created_by)
           VALUES ($1, $2, 'receipt', 'draft', $3)
           RETURNING id, created_at AS "createdAt"`,
          [input.warehouseId, input.documentNo, input.createdByUserId],
        );
        const row = document.rows[0];
        if (!row) throw new Error("Receipt insert returned no row");

        for (const line of input.lines) {
          const policy = await client.query<{ trackingMode: TrackingMode; expiryManaged: boolean }>(
            `SELECT p.tracking_mode AS "trackingMode", p.expiry_managed AS "expiryManaged"
             FROM products p
             JOIN locations l ON l.id = $3 AND l.warehouse_id = $1 AND l.status = 'active'
             WHERE p.id = $2 AND p.warehouse_id = $1 AND p.status = 'active'`,
            [input.warehouseId, line.productId, line.locationId],
          );
          const productPolicy = policy.rows[0];
          if (!productPolicy) throw new Error("SCOPE_NOT_FOUND");
          validateReceiptLine(productPolicy, line);
          await client.query(
            `INSERT INTO stock_document_lines (document_id, location_id, product_id, quantity, snapshot)
             VALUES ($1, $2, $3, $4, $5)`,
            [row.id, line.locationId, line.productId, line.quantity, {
              lotCode: line.lotCode ?? null,
              serialCode: line.serialCode ?? null,
              manufacturedAt: line.manufacturedAt ?? null,
              expiresAt: line.expiresAt ?? null,
            }],
          );
        }
        await client.query("COMMIT");
        return {
          id: row.id,
          warehouseId: input.warehouseId,
          documentNo: input.documentNo,
          status: "draft",
          lineCount: input.lines.length,
          confirmedAt: null,
          createdAt: row.createdAt,
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async listReceipts(warehouseId, limit, offset) {
      const [rows, count] = await Promise.all([
        pool.query<Receipt & { lineCount: string }>(
          `SELECT d.id, d.warehouse_id AS "warehouseId", d.document_no AS "documentNo", d.status,
                  count(l.id) AS "lineCount", d.confirmed_at AS "confirmedAt", d.created_at AS "createdAt"
           FROM stock_documents d
           LEFT JOIN stock_document_lines l ON l.document_id = d.id
           WHERE d.document_type = 'receipt' AND ($1::uuid IS NULL OR d.warehouse_id = $1)
           GROUP BY d.id
           ORDER BY d.created_at DESC
           LIMIT $2 OFFSET $3`,
          [warehouseId, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(*) FROM stock_documents
           WHERE document_type = 'receipt' AND ($1::uuid IS NULL OR warehouse_id = $1)`,
          [warehouseId],
        ),
      ]);
      return {
        data: rows.rows.map((row) => ({ ...row, lineCount: Number(row.lineCount) })),
        total: Number(count.rows[0]?.count ?? 0),
      };
    },
    async confirmReceipt(warehouseId, receiptId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const document = await client.query<{ status: Receipt["status"] }>(
          `SELECT status FROM stock_documents
           WHERE id = $1 AND warehouse_id = $2 AND document_type = 'receipt'
           FOR UPDATE`,
          [receiptId, warehouseId],
        );
        const status = document.rows[0]?.status;
        if (!status) throw new Error("RECEIPT_NOT_FOUND");
        if (status === "confirmed") {
          const count = await client.query<{ count: string }>(`SELECT count(*) FROM stock_movements WHERE document_id = $1`, [receiptId]);
          await client.query("COMMIT");
          return { documentId: receiptId, movementCount: Number(count.rows[0]?.count ?? 0), alreadyConfirmed: true };
        }
        if (status !== "draft") throw new Error("INVALID_STATE");

        const lines = await client.query<{
          locationId: string;
          productId: string;
          quantity: string;
          trackingMode: TrackingMode;
          expiryManaged: boolean;
          snapshot: { lotCode?: string; serialCode?: string; manufacturedAt?: string; expiresAt?: string };
        }>(
          `SELECT l.location_id AS "locationId", l.product_id AS "productId", l.quantity,
                  p.tracking_mode AS "trackingMode", p.expiry_managed AS "expiryManaged", l.snapshot
           FROM stock_document_lines l
           JOIN products p ON p.id = l.product_id AND p.warehouse_id = $2
           WHERE l.document_id = $1
           ORDER BY l.id`,
          [receiptId, warehouseId],
        );
        const movementLines = lines.rows.map((line) => {
          const receiptLine = {
            locationId: line.locationId,
            productId: line.productId,
            quantity: Number(line.quantity),
            lotCode: line.snapshot.lotCode ?? undefined,
            serialCode: line.snapshot.serialCode ?? undefined,
            manufacturedAt: line.snapshot.manufacturedAt ?? undefined,
            expiresAt: line.snapshot.expiresAt ?? undefined,
          };
          validateReceiptLine(line, receiptLine);
          return {
            locationId: receiptLine.locationId,
            productId: receiptLine.productId,
            quantityDelta: receiptLine.quantity,
            lotCode: receiptLine.lotCode ?? null,
            serialCode: receiptLine.serialCode ?? null,
            manufacturedAt: receiptLine.manufacturedAt ?? null,
            expiresAt: receiptLine.expiresAt ?? null,
          };
        });
        await postStockLines(client, { warehouseId, documentId: receiptId, lines: movementLines });
        await client.query(`UPDATE stock_documents SET status = 'confirmed', confirmed_at = now(), updated_at = now() WHERE id = $1`, [receiptId]);
        await client.query("COMMIT");
        return { documentId: receiptId, movementCount: movementLines.length, alreadyConfirmed: false };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
