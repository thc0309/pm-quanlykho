import type { Context, Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import { auditChange, requireAccess, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { routePermissionCatalog, type PermissionCode } from "./permissions.js";

export function lineTotal(quantity: number, unitPrice: number, taxRate: number) {
  return Math.round(quantity * unitPrice * (1 + taxRate / 100) * 100) / 100;
}

export function hasAllSalesLines(requested: number, inserted: number) {
  return requested === inserted;
}

const salesSchema = z.object({
  documentNo: z.string().trim().min(1).max(80),
  kind: z.enum(["quote", "order"]),
  customerId: z.string().uuid(),
  lines: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    unitPrice: z.number().nonnegative(),
    taxRate: z.number().min(0).max(100),
  })).min(1).max(200),
}).strict();

function actorFor(c: Context, auth: AuthStore, access: AccessStore, secret: string, permission: PermissionCode) {
  return requireAccess(c, auth, access, secret, { permission });
}

function mapSalesError(error: unknown): never {
  const code = typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "";
  if (code === "23505") {
    throw new HttpError(409, "DUPLICATE", "Số chứng từ đã tồn tại");
  }
  throw error;
}

export function registerSalesRoutes(
  app: Hono,
  auth: AuthStore,
  access: AccessStore,
  pool: Pool,
  secret: string,
) {
  app.get("/api/sales", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["GET /api/sales"]);
    const page = parsePagination(c.req.query());
    const result = await pool.query(
      `SELECT d.id,d.document_no AS "documentNo",d.kind,d.status,
        partner.name AS "customerName",
        coalesce(sum(l.quantity*l.unit_price*(1+l.tax_rate/100)),0)::float8 total
       FROM sales_documents d
       JOIN partners partner ON partner.id=d.customer_id
       LEFT JOIN sales_document_lines l ON l.sales_document_id=d.id
       WHERE d.warehouse_id=$1
       GROUP BY d.id,partner.id
       ORDER BY d.created_at DESC LIMIT $2 OFFSET $3`,
      [actor.user.warehouseId, page.pageSize, page.offset],
    );
    return c.json({ data: result.rows });
  });

  app.post("/api/sales", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["POST /api/sales"]);
    const input = await parseJson(c, salesSchema);
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const customer = await db.query(
        "SELECT 1 FROM partners WHERE id=$1 AND warehouse_id=$2 AND kind='customer' AND status='active'",
        [input.customerId, actor.user.warehouseId],
      );
      if (!customer.rowCount) {
        throw new HttpError(422, "SCOPE_NOT_FOUND", "Customer không thuộc kho");
      }

      const document = await db.query<{ id: string }>(
        `INSERT INTO sales_documents(warehouse_id,customer_id,document_no,kind,created_by)
         VALUES($1,$2,$3,$4,$5) RETURNING id`,
        [actor.user.warehouseId, input.customerId, input.documentNo, input.kind, actor.user.id],
      );
      let insertedLines = 0;
      for (const line of input.lines) {
        const inserted = await db.query(
          `INSERT INTO sales_document_lines(sales_document_id,product_id,quantity,unit_price,tax_rate)
           SELECT $1,id,$3,$4,$5 FROM products
           WHERE id=$2 AND warehouse_id=$6 AND status='active'`,
          [document.rows[0]!.id, line.productId, line.quantity, line.unitPrice, line.taxRate, actor.user.warehouseId],
        );
        insertedLines += inserted.rowCount ?? 0;
      }
      if (!hasAllSalesLines(input.lines.length, insertedLines)) {
        throw new HttpError(422, "SCOPE_NOT_FOUND", "Product không thuộc kho");
      }

      await db.query("COMMIT");
      return c.json({ document: { id: document.rows[0]!.id, status: "draft" } }, 201);
    } catch (error) {
      await db.query("ROLLBACK");
      mapSalesError(error);
    } finally {
      db.release();
    }
  });

  app.post("/api/sales/:id/approve", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["POST /api/sales/:id/approve"]);
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const document = await db.query<{ kind: string; documentNo: string }>(
        `SELECT kind,document_no AS "documentNo" FROM sales_documents
         WHERE id=$1 AND warehouse_id=$2 AND status='draft' FOR UPDATE`,
        [c.req.param("id"), actor.user.warehouseId],
      );
      if (!document.rows[0]) {
        throw new HttpError(409, "INVALID_STATE", "Document không ở draft");
      }

      let outboundId: string | null = null;
      if (document.rows[0].kind === "order") {
        const outbound = await db.query<{ id: string }>(
          `INSERT INTO stock_documents(warehouse_id,document_no,document_type,status,created_by)
           VALUES($1,$2||'-OUT','issue','draft',$3) RETURNING id`,
          [actor.user.warehouseId, document.rows[0].documentNo, actor.user.id],
        );
        outboundId = outbound.rows[0]!.id;
        await db.query(
          `INSERT INTO stock_document_lines(document_id,product_id,quantity,snapshot)
           SELECT $1,product_id,quantity,jsonb_build_object('salesLineId',id)
           FROM sales_document_lines WHERE sales_document_id=$2`,
          [outboundId, c.req.param("id")],
        );
      }

      await db.query(
        "UPDATE sales_documents SET status='approved',outbound_document_id=$2,updated_at=now() WHERE id=$1",
        [c.req.param("id"), outboundId],
      );
      await db.query("COMMIT");
      await auditChange(access, actor, {
        warehouseId: actor.user.warehouseId,
        action: "sales.approve",
        entityType: "sales_document",
        entityId: c.req.param("id"),
      });
      return c.json({ result: { outboundId } });
    } catch (error) {
      await db.query("ROLLBACK");
      mapSalesError(error);
    } finally {
      db.release();
    }
  });

  app.post("/api/sales/:id/invoice", async (c) => {
    const actor = await actorFor(c, auth, access, secret, routePermissionCatalog["POST /api/sales/:id/invoice"]);
    const input = await parseJson(c, z.object({ documentNo: z.string().trim().min(1).max(80) }).strict());
    try {
      const result = await pool.query<{ id: string }>(
        `INSERT INTO sales_documents(
          warehouse_id,customer_id,document_no,kind,status,source_document_id,
          outbound_document_id,snapshot,created_by
        )
        SELECT s.warehouse_id,s.customer_id,$3,'invoice','issued',s.id,s.outbound_document_id,
          jsonb_build_object(
            'order',to_jsonb(s),
            'lines',(SELECT jsonb_agg(to_jsonb(l)) FROM sales_document_lines l WHERE l.sales_document_id=s.id),
            'shipment',to_jsonb(o)
          ),$4
        FROM sales_documents s
        JOIN stock_documents o ON o.id=s.outbound_document_id AND o.status='shipped'
        WHERE s.id=$1 AND s.warehouse_id=$2 AND s.kind='order'
          AND NOT EXISTS(
            SELECT 1 FROM sales_documents invoice
            WHERE invoice.kind='invoice' AND invoice.source_document_id=s.id
          )
        RETURNING id`,
        [c.req.param("id"), actor.user.warehouseId, input.documentNo, actor.user.id],
      );
      if (!result.rows[0]) {
        throw new HttpError(409, "NOT_SHIPPED_OR_INVOICED", "Order chưa ship hoặc đã xuất hóa đơn");
      }
      return c.json({ invoice: { id: result.rows[0].id } }, 201);
    } catch (error) {
      mapSalesError(error);
    }
  });
}
