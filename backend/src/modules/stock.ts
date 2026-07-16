import type { Context, Hono } from "hono";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";

import { nextOnHand, type StockDocumentType } from "../domain/stock.js";
import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import { auditChange, requireAccess, type AccessActor, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { routePermissionCatalog, type PermissionCode } from "./permissions.js";

type Page<T> = { data: T[]; total: number };

export interface StockMovementLineInput {
  locationId: string;
  productId: string;
  quantityDelta: number;
  lotCode: string | null;
  serialCode: string | null;
  manufacturedAt?: string | null;
  expiresAt?: string | null;
}

export interface StockMovementInput {
  warehouseId: string;
  documentNo: string;
  documentType: StockDocumentType;
  createdByUserId: string;
  lines: StockMovementLineInput[];
}

export interface StockBalance {
  warehouseId: string;
  locationId: string;
  productId: string;
  lotCode: string | null;
  serialCode: string | null;
  onHand: number;
}

export interface StockStore {
  defaultWarehouseId(): Promise<string | null>;
  postMovements(input: StockMovementInput): Promise<{ documentId: string; movementCount: number }>;
  listBalances(warehouseId: string | null, limit: number, offset: number): Promise<Page<StockBalance>>;
}

async function resolveLot(client: PoolClient, input: {
  warehouseId: string;
  productId: string;
  lotCode: string;
  manufacturedAt?: string | null;
  expiresAt?: string | null;
}) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO lots (warehouse_id, product_id, lot_code, manufactured_at, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (warehouse_id, product_id, lot_code)
     DO UPDATE SET manufactured_at = COALESCE(lots.manufactured_at, EXCLUDED.manufactured_at),
                   expires_at = COALESCE(lots.expires_at, EXCLUDED.expires_at)
     RETURNING id`,
    [input.warehouseId, input.productId, input.lotCode, input.manufacturedAt, input.expiresAt],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("Lot upsert returned no row");
  return id;
}

async function resolveSerial(client: PoolClient, input: {
  warehouseId: string;
  productId: string;
  serialCode: string;
  quantityDelta: number;
}) {
  if (input.quantityDelta > 0) {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO serials (warehouse_id, product_id, serial_code, status)
       VALUES ($1, $2, $3, 'in_stock')
       RETURNING id`,
      [input.warehouseId, input.productId, input.serialCode],
    );
    const id = inserted.rows[0]?.id;
    if (!id) throw new Error("Serial insert returned no row");
    return id;
  }

  const existing = await client.query<{ id: string }>(
    `SELECT id FROM serials
     WHERE warehouse_id = $1 AND product_id = $2 AND serial_code = $3
     FOR UPDATE`,
    [input.warehouseId, input.productId, input.serialCode],
  );
  const id = existing.rows[0]?.id;
  if (!id) throw Object.assign(new Error("negative stock"), { code: "NEGATIVE_STOCK" });
  await client.query(`UPDATE serials SET status = 'issued', updated_at = now() WHERE id = $1`, [id]);
  return id;
}

async function applyBalance(client: PoolClient, input: {
  warehouseId: string;
  locationId: string;
  productId: string;
  lotId: string | null;
  serialId: string | null;
  quantityDelta: number;
}) {
  await client.query(
    `INSERT INTO stock_balances (warehouse_id, location_id, product_id, lot_id, serial_id, on_hand)
     VALUES ($1, $2, $3, $4, $5, 0)
     ON CONFLICT (warehouse_id, location_id, product_id, lot_id, serial_id) DO NOTHING`,
    [input.warehouseId, input.locationId, input.productId, input.lotId, input.serialId],
  );
  const current = await client.query<{ id: string; onHand: string }>(
    `SELECT id, on_hand AS "onHand" FROM stock_balances
     WHERE warehouse_id = $1
       AND location_id = $2
       AND product_id = $3
       AND lot_id IS NOT DISTINCT FROM $4::uuid
       AND serial_id IS NOT DISTINCT FROM $5::uuid
     FOR UPDATE`,
    [input.warehouseId, input.locationId, input.productId, input.lotId, input.serialId],
  );
  const row = current.rows[0];
  if (!row) throw new Error("Balance upsert returned no row");
  const onHand = nextOnHand(Number(row.onHand), input.quantityDelta);
  await client.query(`UPDATE stock_balances SET on_hand = $1, updated_at = now() WHERE id = $2`, [onHand, row.id]);
}

export async function postStockLines(client: PoolClient, input: {
  warehouseId: string;
  documentId: string;
  lines: StockMovementLineInput[];
}) {
  for (const line of input.lines) {
    const lotId = line.lotCode
      ? await resolveLot(client, {
        warehouseId: input.warehouseId,
        productId: line.productId,
        lotCode: line.lotCode,
        manufacturedAt: line.manufacturedAt,
        expiresAt: line.expiresAt,
      })
      : null;
    const serialId = line.serialCode
      ? await resolveSerial(client, {
        warehouseId: input.warehouseId,
        productId: line.productId,
        serialCode: line.serialCode,
        quantityDelta: line.quantityDelta,
      })
      : null;

    await applyBalance(client, { ...line, warehouseId: input.warehouseId, lotId, serialId });
    await client.query(
      `INSERT INTO stock_movements
        (warehouse_id, document_id, location_id, product_id, lot_id, serial_id, quantity_delta, snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.warehouseId,
        input.documentId,
        line.locationId,
        line.productId,
        lotId,
        serialId,
        line.quantityDelta,
        {
          lotCode: line.lotCode,
          serialCode: line.serialCode,
          manufacturedAt: line.manufacturedAt,
          expiresAt: line.expiresAt,
        },
      ],
    );
  }
}

const documentTypes = [
  "receipt",
  "issue",
  "adjustment",
  "transfer_out",
  "transfer_in",
  "return_customer",
  "return_supplier",
  "stock_count",
] as const;

const lineSchema = z.object({
  locationId: z.string().min(1).max(120),
  productId: z.string().min(1).max(120),
  quantityDelta: z.coerce.number().finite().refine((value) => value !== 0, "Quantity delta cannot be zero"),
  lotCode: z.string().trim().min(1).max(120).optional(),
  serialCode: z.string().trim().min(1).max(120).optional(),
  manufacturedAt: z.string().date().optional(),
  expiresAt: z.string().date().optional(),
}).strict().superRefine((value, context) => {
  if (value.serialCode && Math.abs(value.quantityDelta) !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["quantityDelta"], message: "Serial quantity must be 1 or -1" });
  }
});

const movementSchema = z.object({
  documentNo: z.string().trim().min(1).max(80),
  documentType: z.enum(documentTypes),
  lines: z.array(lineSchema).min(1).max(200),
}).strict();

async function warehouseFor(context: Context, actor: AccessActor, store: StockStore) {
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

function stockError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23505" || error.code === "DUPLICATE_SERIAL") {
      throw new HttpError(409, "DUPLICATE", "Serial hoặc chứng từ đã tồn tại");
    }
    if (error.code === "NEGATIVE_STOCK") {
      throw new HttpError(409, "NEGATIVE_STOCK", "Không đủ tồn kho");
    }
  }
  if (error instanceof Error && error.message === "NEGATIVE_STOCK") {
    throw new HttpError(409, "NEGATIVE_STOCK", "Không đủ tồn kho");
  }
  throw error;
}

function pageResponse<T>(data: Page<T>, page: number, pageSize: number) {
  return {
    data: data.data,
    pagination: {
      page,
      pageSize,
      totalItems: data.total,
      totalPages: Math.ceil(data.total / pageSize),
    },
  };
}

export function registerStockRoutes(
  app: Hono,
  authStore: AuthStore,
  accessStore: AccessStore,
  store: StockStore,
  sessionSecret: string,
) {
  const actor = (context: Context, permission: PermissionCode) =>
    requireAccess(context, authStore, accessStore, sessionSecret, { permission });

  app.get("/api/stock/balances", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/stock/balances"]);
    const pagination = parsePagination(c.req.query());
    const result = await store.listBalances(warehouseScopeFor(c, current), pagination.pageSize, pagination.offset);
    return c.json(pageResponse(result, pagination.page, pagination.pageSize));
  });

  app.post("/api/stock/movements", async (c) => {
    const current = await actor(c, routePermissionCatalog["POST /api/stock/movements"]);
    const warehouseId = await warehouseFor(c, current, store);
    const input = await parseJson(c, movementSchema);
    let result: { documentId: string; movementCount: number };
    try {
      result = await store.postMovements({
        warehouseId,
        documentNo: input.documentNo,
        documentType: input.documentType,
        createdByUserId: current.user.id,
        lines: input.lines.map((line) => ({
          locationId: line.locationId,
          productId: line.productId,
          quantityDelta: line.quantityDelta,
          lotCode: line.lotCode ?? null,
          serialCode: line.serialCode ?? null,
          manufacturedAt: line.manufacturedAt ?? null,
          expiresAt: line.expiresAt ?? null,
        })),
      });
    } catch (error) {
      stockError(error);
    }
    await auditChange(accessStore, current, {
      warehouseId,
      action: "stock.movement.post",
      entityType: "stock_document",
      entityId: result!.documentId,
      metadata: { documentNo: input.documentNo, movementCount: result!.movementCount },
    });
    return c.json({ result: result! }, 201);
  });
}

export function createPostgresStockStore(pool: Pool): StockStore {
  return {
    async defaultWarehouseId() {
      const result = await pool.query<{ id: string }>(`SELECT id FROM warehouses ORDER BY code LIMIT 2`);
      return result.rows.length === 1 ? result.rows[0]!.id : null;
    },
    async postMovements(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const document = await client.query<{ id: string }>(
          `INSERT INTO stock_documents (warehouse_id, document_no, document_type, status, confirmed_at, created_by)
           VALUES ($1, $2, $3, 'confirmed', now(), $4)
           RETURNING id`,
          [input.warehouseId, input.documentNo, input.documentType, input.createdByUserId],
        );
        const documentId = document.rows[0]?.id;
        if (!documentId) throw new Error("Stock document insert returned no row");

        await postStockLines(client, { warehouseId: input.warehouseId, documentId, lines: input.lines });

        await client.query("COMMIT");
        return { documentId, movementCount: input.lines.length };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async listBalances(warehouseId, limit, offset) {
      const [rows, count] = await Promise.all([
        pool.query<StockBalance & { onHand: string }>(
          `SELECT sb.warehouse_id AS "warehouseId",
                  sb.location_id AS "locationId",
                  sb.product_id AS "productId",
                  l.lot_code AS "lotCode",
                  s.serial_code AS "serialCode",
                  sb.on_hand AS "onHand"
           FROM stock_balances sb
           LEFT JOIN lots l ON l.id = sb.lot_id
           LEFT JOIN serials s ON s.id = sb.serial_id
           WHERE ($1::uuid IS NULL OR sb.warehouse_id = $1)
           ORDER BY sb.updated_at DESC, sb.created_at DESC
           LIMIT $2 OFFSET $3`,
          [warehouseId, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(*) FROM stock_balances WHERE ($1::uuid IS NULL OR warehouse_id = $1)`,
          [warehouseId],
        ),
      ]);
      return {
        data: rows.rows.map((row) => ({ ...row, onHand: Number(row.onHand) })),
        total: Number(count.rows[0]?.count ?? 0),
      };
    },
  };
}
