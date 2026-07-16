import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import type { AccessStore, AuditEntry } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import { registerProductRoutes, type Product, type ProductStore } from "../src/modules/products.js";

const secret = "test-session-secret-that-is-at-least-32-characters";

class MemoryProductStore implements AuthStore, AccessStore, ProductStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  audits: AuditEntry[] = [];
  products: Product[] = [];
  warehouseIds = ["warehouse-a"];
  categoryWarehouse = new Map<string, string>();
  unitWarehouse = new Map<string, string>();
  busyProductIds = new Set<string>();

  async findUserByEmail(email: string) { return this.users.find((user) => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.find((user) => user.id === id) ?? null; }
  async createSession(session: AuthSession) { this.sessions.set(session.tokenHash, session); }
  async findSession(hash: string) { return this.sessions.get(hash) ?? null; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async updatePassword() {}
  async listPermissions(userId: string) { return this.permissions.get(userId) ?? []; }
  async insertAudit(entry: AuditEntry) { this.audits.push(entry); }
  async defaultWarehouseId() { return this.warehouseIds.length === 1 ? this.warehouseIds[0]! : null; }
  async listProducts(warehouseId: string | null) {
    const data = warehouseId ? this.products.filter((item) => item.warehouseId === warehouseId) : this.products;
    return { data, total: data.length };
  }
  async createProduct(input: Omit<Product, "id" | "status">) {
    if (this.products.some((item) => item.warehouseId === input.warehouseId && item.sku === input.sku)) {
      throw Object.assign(new Error("duplicate sku"), { code: "23505" });
    }
    if (this.products.some((item) => item.warehouseId === input.warehouseId && item.barcodes.some((barcode) => input.barcodes.includes(barcode)))) {
      throw Object.assign(new Error("duplicate barcode"), { code: "23505" });
    }
    const product: Product = { ...input, id: randomUUID(), status: "active" };
    this.products.push(product);
    return product;
  }
  async findByBarcode(warehouseId: string, barcode: string) {
    return this.products.find((item) => item.warehouseId === warehouseId && item.barcodes.includes(barcode)) ?? null;
  }
  async updateProduct(
    warehouseId: string,
    id: string,
    input: Partial<Pick<Product, "name" | "barcodes" | "categoryId" | "baseUnitId" | "expiryManaged" | "fefoEnabled">>,
  ) {
    const product = this.products.find((item) => item.id === id && item.warehouseId === warehouseId);
    if (!product) return null;
    if (input.categoryId && this.categoryWarehouse.get(input.categoryId) !== warehouseId) throw Object.assign(new Error("invalid reference"), { code: "INVALID_PRODUCT_REFERENCE" });
    if (input.baseUnitId && this.unitWarehouse.get(input.baseUnitId) !== warehouseId) throw Object.assign(new Error("invalid reference"), { code: "INVALID_PRODUCT_REFERENCE" });
    if (input.barcodes?.some((barcode) => this.products.some((item) => item.id !== id && item.warehouseId === warehouseId && item.barcodes.includes(barcode)))) {
      throw Object.assign(new Error("duplicate barcode"), { code: "23505" });
    }
    if (this.busyProductIds.has(id) && Object.keys(input).some((key) => key !== "name")) {
      throw Object.assign(new Error("product in use"), { code: "PRODUCT_IN_USE" });
    }
    Object.assign(product, input);
    return product;
  }
  async setProductStatus(warehouseId: string, id: string, status: Product["status"]) {
    const product = this.products.find((item) => item.id === id && item.warehouseId === warehouseId);
    if (!product) return null;
    if (status === "inactive" && this.busyProductIds.has(id)) throw Object.assign(new Error("product in use"), { code: "PRODUCT_IN_USE" });
    product.status = status;
    return product;
  }
}

async function setup() {
  const store = new MemoryProductStore();
  const passwordHash = await hashPassword("secure-password");
  store.users.push(
    {
      id: "admin-a",
      email: "admin@example.test",
      fullName: "Warehouse Admin",
      kind: "warehouse_admin",
      warehouseId: "warehouse-a",
      passwordHash,
      mustChangePassword: false,
      status: "active",
    },
    {
      id: "denied-a",
      email: "denied@example.test",
      fullName: "Denied User",
      kind: "warehouse_user",
      warehouseId: "warehouse-a",
      passwordHash,
      mustChangePassword: false,
      status: "active",
    },
  );
  store.permissions.set("admin-a", ["products.view", "products.create", "products.update", "products.delete"]);
  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerProductRoutes(app, store, store, store, secret);
  return { app, store };
}

async function login(app: ReturnType<typeof createApp>, email: string) {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "secure-password" }),
  });
  return (response.headers.get("set-cookie") ?? "").split(";")[0];
}

test("admin creates products for none, lot and serial tracking and resolves barcode", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");

  for (const body of [
    { sku: "SKU-NONE", name: "Hàng thường", trackingMode: "none", barcodes: ["BC-NONE"] },
    { sku: "SKU-LOT", name: "Hàng theo lô", trackingMode: "lot", expiryManaged: true, fefoEnabled: true, barcodes: ["BC-LOT", "BC-LOT-2"] },
    { sku: "SKU-SERIAL", name: "Hàng serial", trackingMode: "serial", barcodes: ["BC-SERIAL"] },
  ]) {
    const response = await app.request("/api/products", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 201);
  }

  const lookup = await app.request("/api/products/lookup/BC-LOT-2", { headers: { cookie } });
  assert.equal(lookup.status, 200);
  assert.equal((await lookup.json()).product.sku, "SKU-LOT");

  const list = await app.request("/api/products", { headers: { cookie } });
  assert.equal((await list.json()).pagination.totalItems, 3);
  assert.equal(store.audits.length, 3);
});

test("products reject duplicate sku, duplicate barcode and invalid tracking policy", async () => {
  const { app } = await setup();
  const cookie = await login(app, "admin@example.test");

  const first = await app.request("/api/products", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ sku: "SKU-1", name: "Hàng một", trackingMode: "none", barcodes: ["BC-1"] }),
  });
  assert.equal(first.status, 201);

  for (const body of [
    { sku: "SKU-1", name: "Trùng SKU", trackingMode: "none", barcodes: ["BC-2"] },
    { sku: "SKU-2", name: "Trùng barcode", trackingMode: "none", barcodes: ["BC-1"] },
  ]) {
    const response = await app.request("/api/products", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 409);
  }

  for (const body of [
    { sku: "SKU-3", name: "Sai expiry", trackingMode: "none", expiryManaged: true, barcodes: ["BC-3"] },
    { sku: "SKU-4", name: "Sai FEFO", trackingMode: "serial", fefoEnabled: true, barcodes: ["BC-4"] },
  ]) {
    const response = await app.request("/api/products", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 422);
  }
});

test("product view permission cannot create a product", async () => {
  const { app, store } = await setup();
  store.permissions.set("denied-a", ["products.view"]);
  const cookie = await login(app, "denied@example.test");
  assert.equal((await app.request("/api/products", { headers: { cookie } })).status, 200);
  const response = await app.request("/api/products", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ sku: "NO-SKU", name: "Không tạo", trackingMode: "none", barcodes: ["NO-BC"] }),
  });
  assert.equal(response.status, 403);
  assert.equal((await app.request(`/api/products/${randomUUID()}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Không được sửa" }),
  })).status, 403);
  assert.equal((await app.request(`/api/products/${randomUUID()}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ status: "inactive" }),
  })).status, 403);
  assert.equal(store.audits.length, 0);
});

test("product update and status are scoped, atomic and audited", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const categoryId = randomUUID();
  const unitId = randomUUID();
  store.categoryWarehouse.set(categoryId, "warehouse-a");
  store.unitWarehouse.set(unitId, "warehouse-a");
  const product = await store.createProduct({
    warehouseId: "warehouse-a",
    sku: "SKU-LOT",
    name: "Hàng theo lô",
    productType: "stock",
    trackingMode: "lot",
    expiryManaged: false,
    fefoEnabled: false,
    categoryId: null,
    baseUnitId: null,
    barcodes: ["BC-OLD"],
  });

  const updated = await app.request(`/api/products/${product.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Hàng FEFO", barcodes: ["BC-NEW", "BC-NEW-2"], categoryId, baseUnitId: unitId, expiryManaged: true, fefoEnabled: true }),
  });
  assert.equal(updated.status, 200);
  assert.deepEqual((await updated.json()).product.barcodes, ["BC-NEW", "BC-NEW-2"]);

  const status = await app.request(`/api/products/${product.id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ status: "inactive" }),
  });
  assert.equal(status.status, 200);
  assert.equal((await status.json()).product.status, "inactive");
  assert.deepEqual(store.audits.slice(-2).map((entry) => entry.action), ["products.update", "products.status"]);
});

test("product mutations reject immutable, duplicate, cross-scope and in-use changes", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const product = await store.createProduct({ warehouseId: "warehouse-a", sku: "SKU-1", name: "Sản phẩm một", productType: "stock", trackingMode: "lot", expiryManaged: false, fefoEnabled: false, categoryId: null, baseUnitId: null, barcodes: ["BC-1"] });
  await store.createProduct({ warehouseId: "warehouse-a", sku: "SKU-2", name: "Sản phẩm hai", productType: "stock", trackingMode: "none", expiryManaged: false, fefoEnabled: false, categoryId: null, baseUnitId: null, barcodes: ["BC-2"] });

  for (const body of [{ sku: "SKU-CHANGED" }, { trackingMode: "serial" }, { productType: "service" }]) {
    const response = await app.request(`/api/products/${product.id}`, { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
    assert.equal(response.status, 422);
  }

  const duplicate = await app.request(`/api/products/${product.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Không được lưu dở", barcodes: ["BC-2"] }),
  });
  assert.equal(duplicate.status, 409);
  assert.equal(product.name, "Sản phẩm một");
  assert.deepEqual(product.barcodes, ["BC-1"]);

  const outsideCategoryId = randomUUID();
  store.categoryWarehouse.set(outsideCategoryId, "warehouse-b");
  const outsideReference = await app.request(`/api/products/${product.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ categoryId: outsideCategoryId }),
  });
  assert.equal(outsideReference.status, 409);

  store.busyProductIds.add(product.id);
  const dangerousUpdate = await app.request(`/api/products/${product.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ expiryManaged: true }),
  });
  assert.equal(dangerousUpdate.status, 409);
  const deactivate = await app.request(`/api/products/${product.id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ status: "inactive" }),
  });
  assert.equal(deactivate.status, 409);

  const outsideProduct = await store.createProduct({ warehouseId: "warehouse-b", sku: "SKU-B", name: "Kho B", productType: "stock", trackingMode: "none", expiryManaged: false, fefoEnabled: false, categoryId: null, baseUnitId: null, barcodes: ["BC-B"] });
  const outsideScope = await app.request(`/api/products/${outsideProduct.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Không được sửa" }),
  });
  assert.equal(outsideScope.status, 404);
  assert.equal(store.audits.length, 0);
});
