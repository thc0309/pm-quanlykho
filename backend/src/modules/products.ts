import type { Context, Hono } from "hono";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";

import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import { auditChange, requireAccess, type AccessActor, type AccessStore } from "./access.js";
import type { AuthStore } from "./auth.js";
import { routePermissionCatalog, type PermissionCode } from "./permissions.js";

type Page<T> = { data: T[]; total: number };

export interface Product {
  id: string;
  warehouseId: string;
  categoryId: string | null;
  baseUnitId: string | null;
  sku: string;
  name: string;
  productType: "stock" | "non_stock" | "service";
  trackingMode: "none" | "lot" | "serial";
  expiryManaged: boolean;
  fefoEnabled: boolean;
  status: "active" | "inactive";
  barcodes: string[];
}

export interface ProductStore {
  defaultWarehouseId(): Promise<string | null>;
  listProducts(warehouseId: string | null, limit: number, offset: number): Promise<Page<Product>>;
  createProduct(input: Omit<Product, "id" | "status">): Promise<Product>;
  updateProduct(
    warehouseId: string,
    id: string,
    input: Partial<Pick<Product, "name" | "barcodes" | "categoryId" | "baseUnitId" | "expiryManaged" | "fefoEnabled">>,
  ): Promise<Product | null>;
  setProductStatus(warehouseId: string, id: string, status: Product["status"]): Promise<Product | null>;
  findByBarcode(warehouseId: string, barcode: string): Promise<Product | null>;
}

const barcodeSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_.-]+$/);

const productSchema = z.object({
  sku: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(160),
  productType: z.enum(["stock", "non_stock", "service"]).default("stock"),
  trackingMode: z.enum(["none", "lot", "serial"]).default("none"),
  expiryManaged: z.boolean().default(false),
  fefoEnabled: z.boolean().default(false),
  categoryId: z.string().uuid().optional(),
  baseUnitId: z.string().uuid().optional(),
  barcodes: z.array(barcodeSchema).min(1).max(10),
}).strict().superRefine((value, context) => {
  if (new Set(value.barcodes).size !== value.barcodes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["barcodes"], message: "Barcodes must be unique" });
  }
  if (value.productType !== "stock" && value.trackingMode !== "none") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["trackingMode"], message: "Only stock products can be tracked" });
  }
  if (value.expiryManaged && value.trackingMode !== "lot") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["expiryManaged"], message: "Expiry requires lot tracking" });
  }
  if (value.fefoEnabled && value.trackingMode !== "lot") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["fefoEnabled"], message: "FEFO requires lot tracking" });
  }
});

const productUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  expiryManaged: z.boolean().optional(),
  fefoEnabled: z.boolean().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  baseUnitId: z.string().uuid().nullable().optional(),
  barcodes: z.array(barcodeSchema).min(1).max(10).optional(),
}).strict().superRefine((value, context) => {
  if (Object.keys(value).length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Cần ít nhất một trường để cập nhật" });
  }
  if (value.barcodes && new Set(value.barcodes).size !== value.barcodes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["barcodes"], message: "Barcode không được trùng" });
  }
});

const productStatusSchema = z.object({ status: z.enum(["active", "inactive"]) }).strict();
const routeIdSchema = z.string().uuid();

async function warehouseFor(context: Context, actor: AccessActor, store: ProductStore) {
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

function conflict(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    throw new HttpError(409, "DUPLICATE", "SKU hoặc barcode đã tồn tại");
  }
  throw error;
}

function mutationError(error: unknown): never {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (error.code === "23505") throw new HttpError(409, "DUPLICATE_PRODUCT", "Barcode đã tồn tại trong kho");
    if (error.code === "23503" || error.code === "INVALID_PRODUCT_REFERENCE") {
      throw new HttpError(409, "INVALID_PRODUCT_REFERENCE", "Danh mục hoặc đơn vị không thuộc kho hiện tại");
    }
    if (error.code === "PRODUCT_IN_USE") {
      throw new HttpError(409, "PRODUCT_IN_USE", "Sản phẩm đã có tồn kho hoặc lịch sử chứng từ");
    }
    if (error.code === "INVALID_TRACKING_POLICY") {
      throw new HttpError(409, "INVALID_TRACKING_POLICY", "Thiết lập hạn dùng hoặc FEFO không phù hợp cách theo dõi sản phẩm");
    }
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

export function registerProductRoutes(
  app: Hono,
  authStore: AuthStore,
  accessStore: AccessStore,
  store: ProductStore,
  sessionSecret: string,
) {
  const actor = (context: Context, permission: PermissionCode) =>
    requireAccess(context, authStore, accessStore, sessionSecret, { permission });

  app.get("/api/products", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/products"]);
    const pagination = parsePagination(c.req.query());
    const result = await store.listProducts(warehouseScopeFor(c, current), pagination.pageSize, pagination.offset);
    return c.json(pageResponse(result, pagination.page, pagination.pageSize));
  });

  app.post("/api/products", async (c) => {
    const current = await actor(c, routePermissionCatalog["POST /api/products"]);
    const warehouseId = await warehouseFor(c, current, store);
    const input = await parseJson(c, productSchema);
    let product: Product;
    try {
      product = await store.createProduct({
        warehouseId,
        sku: input.sku,
        name: input.name,
        productType: input.productType ?? "stock",
        trackingMode: input.trackingMode ?? "none",
        expiryManaged: input.expiryManaged ?? false,
        fefoEnabled: input.fefoEnabled ?? false,
        barcodes: input.barcodes,
        categoryId: input.categoryId ?? null,
        baseUnitId: input.baseUnitId ?? null,
      });
    } catch (error) {
      conflict(error);
    }
    await auditChange(accessStore, current, { warehouseId, action: "products.create", entityType: "product", entityId: product!.id });
    return c.json({ product: product! }, 201);
  });

  app.patch("/api/products/:id", async (c) => {
    const current = await actor(c, routePermissionCatalog["PATCH /api/products/:id"]);
    const warehouseId = await warehouseFor(c, current, store);
    const id = routeIdSchema.parse(c.req.param("id"));
    const input = await parseJson(c, productUpdateSchema);
    let product: Product | null;
    try {
      product = await store.updateProduct(warehouseId, id, input);
    } catch (error) {
      mutationError(error);
    }
    if (!product!) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy sản phẩm");
    await auditChange(accessStore, current, {
      warehouseId,
      action: "products.update",
      entityType: "product",
      entityId: product.id,
      metadata: { fields: Object.keys(input) },
    });
    return c.json({ product });
  });

  app.patch("/api/products/:id/status", async (c) => {
    const current = await actor(c, routePermissionCatalog["PATCH /api/products/:id/status"]);
    const warehouseId = await warehouseFor(c, current, store);
    const id = routeIdSchema.parse(c.req.param("id"));
    const input = await parseJson(c, productStatusSchema);
    let product: Product | null;
    try {
      product = await store.setProductStatus(warehouseId, id, input.status);
    } catch (error) {
      mutationError(error);
    }
    if (!product!) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy sản phẩm");
    await auditChange(accessStore, current, {
      warehouseId,
      action: "products.status",
      entityType: "product",
      entityId: product.id,
      metadata: { status: input.status },
    });
    return c.json({ product });
  });

  app.get("/api/products/lookup/:barcode", async (c) => {
    const current = await actor(c, routePermissionCatalog["GET /api/products/lookup/:barcode"]);
    const warehouseId = await warehouseFor(c, current, store);
    const barcode = z.string().trim().min(1).max(80).parse(c.req.param("barcode"));
    const product = await store.findByBarcode(warehouseId, barcode);
    if (!product) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy sản phẩm");
    return c.json({ product });
  });
}

export function createPostgresProductStore(pool: Pool): ProductStore {
  const columns = `p.id, p.warehouse_id AS "warehouseId", p.category_id AS "categoryId",
    p.base_unit_id AS "baseUnitId", p.sku, p.name, p.product_type AS "productType",
    p.tracking_mode AS "trackingMode", p.expiry_managed AS "expiryManaged",
    p.fefo_enabled AS "fefoEnabled", p.status`;

  async function rowById(id: string) {
    const result = await pool.query<Product>(
      `SELECT ${columns}, COALESCE(array_agg(pb.barcode ORDER BY pb.barcode) FILTER (WHERE pb.barcode IS NOT NULL), '{}') AS barcodes
       FROM products p
       LEFT JOIN product_barcodes pb ON pb.product_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async function productInUse(client: PoolClient, id: string) {
    const result = await client.query<{ busy: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM stock_balances WHERE product_id = $1 AND on_hand <> 0
         UNION ALL SELECT 1 FROM stock_document_lines WHERE product_id = $1
         UNION ALL SELECT 1 FROM stock_movements WHERE product_id = $1
         UNION ALL SELECT 1 FROM lots WHERE product_id = $1
         UNION ALL SELECT 1 FROM serials WHERE product_id = $1
         UNION ALL SELECT 1 FROM stock_reservations WHERE product_id = $1 AND status IN ('reserved', 'picked')
       ) AS busy`,
      [id],
    );
    return result.rows[0]?.busy ?? false;
  }

  async function assertScopedReferences(
    client: PoolClient,
    warehouseId: string,
    input: Partial<Pick<Product, "categoryId" | "baseUnitId">>,
  ) {
    const result = await client.query<{ categoryValid: boolean; unitValid: boolean }>(
      `SELECT
         ($2::boolean = false OR $3::uuid IS NULL OR EXISTS (SELECT 1 FROM categories WHERE id = $3 AND warehouse_id = $1)) AS "categoryValid",
         ($4::boolean = false OR $5::uuid IS NULL OR EXISTS (SELECT 1 FROM units WHERE id = $5 AND warehouse_id = $1)) AS "unitValid"`,
      [warehouseId, input.categoryId !== undefined, input.categoryId ?? null, input.baseUnitId !== undefined, input.baseUnitId ?? null],
    );
    if (!result.rows[0]?.categoryValid || !result.rows[0]?.unitValid) {
      throw Object.assign(new Error("Invalid product reference"), { code: "INVALID_PRODUCT_REFERENCE" });
    }
  }

  return {
    async defaultWarehouseId() {
      const result = await pool.query<{ id: string }>(`SELECT id FROM warehouses ORDER BY code LIMIT 2`);
      return result.rows.length === 1 ? result.rows[0]!.id : null;
    },
    async listProducts(warehouseId, limit, offset) {
      const [rows, count] = await Promise.all([
        pool.query<Product>(
          `SELECT ${columns}, COALESCE(array_agg(pb.barcode ORDER BY pb.barcode) FILTER (WHERE pb.barcode IS NOT NULL), '{}') AS barcodes
           FROM products p
           LEFT JOIN product_barcodes pb ON pb.product_id = p.id
           WHERE ($1::uuid IS NULL OR p.warehouse_id = $1)
           GROUP BY p.id
           ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
          [warehouseId, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(*) FROM products WHERE ($1::uuid IS NULL OR warehouse_id = $1)`,
          [warehouseId],
        ),
      ]);
      return { data: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
    },
    async createProduct(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO products
            (warehouse_id, category_id, base_unit_id, sku, name, product_type, tracking_mode, expiry_managed, fefo_enabled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [input.warehouseId, input.categoryId, input.baseUnitId, input.sku, input.name, input.productType, input.trackingMode, input.expiryManaged, input.fefoEnabled],
        );
        const id = inserted.rows[0]?.id;
        if (!id) throw new Error("Product insert returned no row");
        await client.query(
          `INSERT INTO product_barcodes (warehouse_id, product_id, barcode)
           SELECT $1, $2, unnest($3::text[])`,
          [input.warehouseId, id, input.barcodes],
        );
        await client.query("COMMIT");
        const product = await rowById(id);
        if (!product) throw new Error("Product lookup returned no row");
        return product;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async updateProduct(warehouseId, id, input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const locked = await client.query<Pick<Product, "trackingMode" | "expiryManaged" | "fefoEnabled">>(
          `SELECT tracking_mode AS "trackingMode", expiry_managed AS "expiryManaged", fefo_enabled AS "fefoEnabled"
           FROM products WHERE id = $1 AND warehouse_id = $2 FOR UPDATE`,
          [id, warehouseId],
        );
        const current = locked.rows[0];
        if (!current) {
          await client.query("ROLLBACK");
          return null;
        }
        await assertScopedReferences(client, warehouseId, input);
        const expiryManaged = input.expiryManaged ?? current.expiryManaged;
        const fefoEnabled = input.fefoEnabled ?? current.fefoEnabled;
        if ((expiryManaged || fefoEnabled) && current.trackingMode !== "lot") {
          throw Object.assign(new Error("Invalid tracking policy"), { code: "INVALID_TRACKING_POLICY" });
        }
        if (Object.keys(input).some((key) => key !== "name") && await productInUse(client, id)) {
          throw Object.assign(new Error("Product in use"), { code: "PRODUCT_IN_USE" });
        }
        await client.query(
          `UPDATE products SET
             name = COALESCE($3, name),
             category_id = CASE WHEN $4 THEN $5 ELSE category_id END,
             base_unit_id = CASE WHEN $6 THEN $7 ELSE base_unit_id END,
             expiry_managed = COALESCE($8, expiry_managed),
             fefo_enabled = COALESCE($9, fefo_enabled),
             updated_at = now()
           WHERE id = $1 AND warehouse_id = $2`,
          [id, warehouseId, input.name ?? null, input.categoryId !== undefined, input.categoryId ?? null, input.baseUnitId !== undefined, input.baseUnitId ?? null, input.expiryManaged ?? null, input.fefoEnabled ?? null],
        );
        if (input.barcodes) {
          await client.query(`DELETE FROM product_barcodes WHERE product_id = $1`, [id]);
          await client.query(
            `INSERT INTO product_barcodes (warehouse_id, product_id, barcode)
             SELECT $1, $2, unnest($3::text[])`,
            [warehouseId, id, input.barcodes],
          );
        }
        await client.query("COMMIT");
        return await rowById(id);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async setProductStatus(warehouseId, id, status) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const locked = await client.query<{ status: Product["status"] }>(
          `SELECT status FROM products WHERE id = $1 AND warehouse_id = $2 FOR UPDATE`,
          [id, warehouseId],
        );
        if (!locked.rows[0]) {
          await client.query("ROLLBACK");
          return null;
        }
        if (status === "inactive" && locked.rows[0].status !== "inactive" && await productInUse(client, id)) {
          throw Object.assign(new Error("Product in use"), { code: "PRODUCT_IN_USE" });
        }
        await client.query(`UPDATE products SET status = $3, updated_at = now() WHERE id = $1 AND warehouse_id = $2`, [id, warehouseId, status]);
        await client.query("COMMIT");
        return await rowById(id);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async findByBarcode(warehouseId, barcode) {
      const result = await pool.query<Product>(
        `SELECT ${columns}, COALESCE(array_agg(pb.barcode ORDER BY pb.barcode) FILTER (WHERE pb.barcode IS NOT NULL), '{}') AS barcodes
         FROM products p
         JOIN product_barcodes match_barcode ON match_barcode.product_id = p.id
         LEFT JOIN product_barcodes pb ON pb.product_id = p.id
         WHERE p.warehouse_id = $1 AND match_barcode.barcode = $2
         GROUP BY p.id`,
        [warehouseId, barcode],
      );
      return result.rows[0] ?? null;
    },
  };
}
