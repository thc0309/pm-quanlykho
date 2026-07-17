import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import { HttpError } from "../src/http/errors.js";
import type { AccessStore, AuditEntry } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import type { CategorySpecDefinition, ProductSpecValueInput } from "../src/modules/catalog-specs.js";
import {
  registerProductRoutes,
  type Product,
  type ProductCreateInput,
  type ProductStore,
  type ProductUpdateInput,
} from "../src/modules/products.js";

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
  specDefinitions = new Map<string, CategorySpecDefinition[]>();

  async findUserByEmail(email: string) { return this.users.find((user) => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.find((user) => user.id === id) ?? null; }
  async createSession(session: AuthSession) { this.sessions.set(session.tokenHash, session); }
  async findSession(hash: string) { return this.sessions.get(hash) ?? null; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async updatePassword() {}
  async listPermissions(userId: string) { return this.permissions.get(userId) ?? []; }
  async insertAudit(entry: AuditEntry) { this.audits.push(entry); }
  async defaultWarehouseId() { return this.warehouseIds.length === 1 ? this.warehouseIds[0]! : null; }

  private normalizeSpecValues(
    warehouseId: string,
    categoryId: string | null,
    specValues: ProductSpecValueInput[],
  ) {
    if (!categoryId) {
      if (specValues.length > 0) throw new HttpError(422, "INVALID_SPEC_CATEGORY", "Sản phẩm chưa có danh mục nên không thể lưu thuộc tính");
      return [];
    }

    const definitions = (this.specDefinitions.get(categoryId) ?? []).filter(
      (definition) => definition.warehouseId === warehouseId && definition.status === "active",
    );
    const definitionMap = new Map(definitions.map((definition) => [definition.id, definition]));
    const seen = new Set<string>();
    const normalized: Product["specValues"] = [];

    for (const item of specValues) {
      if (seen.has(item.definitionId)) {
        throw new HttpError(422, "VALIDATION_ERROR", "Thông số không được trùng lặp");
      }
      seen.add(item.definitionId);

      const definition = definitionMap.get(item.definitionId);
      if (!definition) {
        throw new HttpError(422, "INVALID_SPEC_DEFINITION", "Thuộc tính không thuộc danh mục sản phẩm");
      }

      const valueCount = [item.textValue, item.numberValue, item.booleanValue, item.optionValue]
        .filter((value) => value !== undefined && value !== null).length;
      if (valueCount !== 1) {
        throw new HttpError(422, "VALIDATION_ERROR", "Mỗi thuộc tính chỉ được nhập một giá trị hợp lệ");
      }

      if (definition.type === "text") {
        const value = item.textValue?.trim();
        if (!value) throw new HttpError(422, "VALIDATION_ERROR", `Thuộc tính ${definition.name} phải là chuỗi hợp lệ`);
        normalized.push({
          definitionId: definition.id,
          code: definition.code,
          name: definition.name,
          type: definition.type,
          required: definition.required,
          unit: definition.unit,
          sortOrder: definition.sortOrder,
          status: definition.status,
          value,
          optionLabel: null,
        });
        continue;
      }

      if (definition.type === "number") {
        if (typeof item.numberValue !== "number" || !Number.isFinite(item.numberValue)) {
          throw new HttpError(422, "VALIDATION_ERROR", `Thuộc tính ${definition.name} phải là số hợp lệ`);
        }
        const minValue = definition.minValue === null ? null : Number(definition.minValue);
        const maxValue = definition.maxValue === null ? null : Number(definition.maxValue);
        if (minValue !== null && item.numberValue < minValue) {
          throw new HttpError(422, "VALIDATION_ERROR", `Thuộc tính ${definition.name} nhỏ hơn giá trị tối thiểu`);
        }
        if (maxValue !== null && item.numberValue > maxValue) {
          throw new HttpError(422, "VALIDATION_ERROR", `Thuộc tính ${definition.name} lớn hơn giá trị tối đa`);
        }
        normalized.push({
          definitionId: definition.id,
          code: definition.code,
          name: definition.name,
          type: definition.type,
          required: definition.required,
          unit: definition.unit,
          sortOrder: definition.sortOrder,
          status: definition.status,
          value: item.numberValue,
          optionLabel: null,
        });
        continue;
      }

      if (definition.type === "boolean") {
        if (typeof item.booleanValue !== "boolean") {
          throw new HttpError(422, "VALIDATION_ERROR", `Thuộc tính ${definition.name} phải là true/false`);
        }
        normalized.push({
          definitionId: definition.id,
          code: definition.code,
          name: definition.name,
          type: definition.type,
          required: definition.required,
          unit: definition.unit,
          sortOrder: definition.sortOrder,
          status: definition.status,
          value: item.booleanValue,
          optionLabel: null,
        });
        continue;
      }

      const optionValue = item.optionValue?.trim();
      const option = definition.options.find((candidate) => candidate.status === "active" && candidate.value === optionValue);
      if (!option) {
        throw new HttpError(422, "VALIDATION_ERROR", `Giá trị của thuộc tính ${definition.name} không hợp lệ`);
      }
      normalized.push({
        definitionId: definition.id,
        code: definition.code,
        name: definition.name,
        type: definition.type,
        required: definition.required,
        unit: definition.unit,
        sortOrder: definition.sortOrder,
        status: definition.status,
        value: option.value,
        optionLabel: option.label,
      });
    }

    const missingRequired = definitions.filter((definition) => definition.required && !seen.has(definition.id));
    if (missingRequired.length > 0) {
      throw new HttpError(422, "VALIDATION_ERROR", `Thiếu thuộc tính bắt buộc: ${missingRequired.map((definition) => definition.name).join(", ")}`);
    }
    return normalized;
  }

  async listProducts(warehouseId: string | null, _limit: number, _offset: number) {
    const data = warehouseId ? this.products.filter((item) => item.warehouseId === warehouseId) : this.products;
    return { data, total: data.length };
  }
  async findProduct(warehouseId: string, id: string) {
    return this.products.find((item) => item.id === id && item.warehouseId === warehouseId) ?? null;
  }

  async createProduct(input: ProductCreateInput) {
    if (this.products.some((item) => item.warehouseId === input.warehouseId && item.sku === input.sku)) {
      throw Object.assign(new Error("duplicate sku"), { code: "23505" });
    }
    if (this.products.some((item) => item.warehouseId === input.warehouseId && item.barcodes.some((barcode) => input.barcodes.includes(barcode)))) {
      throw Object.assign(new Error("duplicate barcode"), { code: "23505" });
    }
    if (input.categoryId && this.categoryWarehouse.get(input.categoryId) !== input.warehouseId) {
      throw Object.assign(new Error("invalid reference"), { code: "INVALID_PRODUCT_REFERENCE" });
    }
    if (input.baseUnitId && this.unitWarehouse.get(input.baseUnitId) !== input.warehouseId) {
      throw Object.assign(new Error("invalid reference"), { code: "INVALID_PRODUCT_REFERENCE" });
    }

    const product: Product = {
      ...input,
      id: randomUUID(),
      status: "active",
      specValues: this.normalizeSpecValues(input.warehouseId, input.categoryId, input.specValues),
    };
    this.products.push(product);
    return product;
  }

  async findByBarcode(warehouseId: string, barcode: string) {
    return this.products.find((item) => item.warehouseId === warehouseId && item.barcodes.includes(barcode)) ?? null;
  }

  async updateProduct(warehouseId: string, id: string, input: ProductUpdateInput) {
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
    if (input.specValues !== undefined || input.categoryId !== undefined) {
      product.specValues = this.normalizeSpecValues(
        warehouseId,
        input.categoryId !== undefined ? input.categoryId : product.categoryId,
        input.specValues ?? [],
      );
    }
    const { specValues: _specValues, ...rest } = input;
    Object.assign(product, rest);
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

test("product detail returns typed spec values", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const product: Product = {
    id: randomUUID(),
    warehouseId: "warehouse-a",
    categoryId: "category-1",
    baseUnitId: null,
    sku: "SKU-1",
    name: "Laptop",
    productType: "stock",
    trackingMode: "none",
    expiryManaged: false,
    fefoEnabled: false,
    status: "active",
    barcodes: ["BC-1"],
    specValues: [
      {
        definitionId: "definition-1",
        code: "ram",
        name: "RAM",
        type: "number",
        required: true,
        unit: "GB",
        sortOrder: 0,
        status: "active",
        value: 16,
        optionLabel: null,
      },
    ],
  };
  store.products.push(product, { ...product, id: randomUUID(), warehouseId: "warehouse-b" });

  const found = await app.request(`/api/products/${product.id}`, { headers: { cookie } });
  assert.equal(found.status, 200);
  const body = await found.json();
  assert.equal(body.product.specValues[0]?.value, 16);
  assert.equal((await app.request(`/api/products/${store.products[1]!.id}`, { headers: { cookie } })).status, 404);
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
    specValues: [],
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
  const product = await store.createProduct({ warehouseId: "warehouse-a", sku: "SKU-1", name: "Sản phẩm một", productType: "stock", trackingMode: "lot", expiryManaged: false, fefoEnabled: false, categoryId: null, baseUnitId: null, barcodes: ["BC-1"], specValues: [] });
  await store.createProduct({ warehouseId: "warehouse-a", sku: "SKU-2", name: "Sản phẩm hai", productType: "stock", trackingMode: "none", expiryManaged: false, fefoEnabled: false, categoryId: null, baseUnitId: null, barcodes: ["BC-2"], specValues: [] });

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

  const outsideProduct = await store.createProduct({ warehouseId: "warehouse-b", sku: "SKU-B", name: "Kho B", productType: "stock", trackingMode: "none", expiryManaged: false, fefoEnabled: false, categoryId: null, baseUnitId: null, barcodes: ["BC-B"], specValues: [] });
  const outsideScope = await app.request(`/api/products/${outsideProduct.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Không được sửa" }),
  });
  assert.equal(outsideScope.status, 404);
  assert.equal(store.audits.length, 0);
});

test("product create, update and lookup return spec values by category", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const categoryId = randomUUID();
  const ramDefinitionId = randomUUID();
  const colorDefinitionId = randomUUID();
  store.categoryWarehouse.set(categoryId, "warehouse-a");
  store.specDefinitions.set(categoryId, [
    {
      id: ramDefinitionId,
      warehouseId: "warehouse-a",
      categoryId,
      code: "ram",
      name: "RAM",
      type: "number",
      required: true,
      unit: "GB",
      minValue: "1",
      maxValue: "64",
      sortOrder: 1,
      status: "active",
      options: [],
    },
    {
      id: colorDefinitionId,
      warehouseId: "warehouse-a",
      categoryId,
      code: "color",
      name: "Màu",
      type: "select",
      required: false,
      unit: null,
      minValue: null,
      maxValue: null,
      sortOrder: 2,
      status: "active",
      options: [
        { id: randomUUID(), definitionId: colorDefinitionId, value: "black", label: "Đen", sortOrder: 1, status: "active" },
        { id: randomUUID(), definitionId: colorDefinitionId, value: "silver", label: "Bạc", sortOrder: 2, status: "active" },
      ],
    },
  ]);

  const created = await app.request("/api/products", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      sku: "LAPTOP-01",
      name: "Laptop A",
      trackingMode: "none",
      categoryId,
      barcodes: ["LAPTOP-BC"],
      specValues: [
        { definitionId: ramDefinitionId, numberValue: 16 },
        { definitionId: colorDefinitionId, optionValue: "black" },
      ],
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.deepEqual(createdBody.product.specValues.map((item: Product["specValues"][number]) => item.value), [16, "black"]);

  const updated = await app.request(`/api/products/${createdBody.product.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      specValues: [
        { definitionId: ramDefinitionId, numberValue: 32 },
        { definitionId: colorDefinitionId, optionValue: "silver" },
      ],
    }),
  });
  assert.equal(updated.status, 200);
  const updatedBody = await updated.json();
  assert.deepEqual(updatedBody.product.specValues.map((item: Product["specValues"][number]) => item.value), [32, "silver"]);
  assert.equal(updatedBody.product.specValues[1].optionLabel, "Bạc");

  const lookup = await app.request("/api/products/lookup/LAPTOP-BC", { headers: { cookie } });
  assert.equal(lookup.status, 200);
  assert.equal((await lookup.json()).product.specValues[0].value, 32);
});

test("product spec validation rejects missing required, invalid option and category-less values", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const categoryId = randomUUID();
  const requiredDefinitionId = randomUUID();
  const optionDefinitionId = randomUUID();
  store.categoryWarehouse.set(categoryId, "warehouse-a");
  store.specDefinitions.set(categoryId, [
    {
      id: requiredDefinitionId,
      warehouseId: "warehouse-a",
      categoryId,
      code: "cpu",
      name: "CPU",
      type: "text",
      required: true,
      unit: null,
      minValue: null,
      maxValue: null,
      sortOrder: 1,
      status: "active",
      options: [],
    },
    {
      id: optionDefinitionId,
      warehouseId: "warehouse-a",
      categoryId,
      code: "color",
      name: "Màu",
      type: "select",
      required: false,
      unit: null,
      minValue: null,
      maxValue: null,
      sortOrder: 2,
      status: "active",
      options: [
        { id: randomUUID(), definitionId: optionDefinitionId, value: "black", label: "Đen", sortOrder: 1, status: "active" },
      ],
    },
  ]);

  const missingRequired = await app.request("/api/products", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      sku: "LAPTOP-02",
      name: "Laptop thiếu CPU",
      trackingMode: "none",
      categoryId,
      barcodes: ["LAPTOP-02-BC"],
      specValues: [{ definitionId: optionDefinitionId, optionValue: "black" }],
    }),
  });
  assert.equal(missingRequired.status, 422);
  assert.equal((await missingRequired.json()).error.code, "VALIDATION_ERROR");

  const invalidOption = await app.request("/api/products", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      sku: "LAPTOP-03",
      name: "Laptop sai option",
      trackingMode: "none",
      categoryId,
      barcodes: ["LAPTOP-03-BC"],
      specValues: [
        { definitionId: requiredDefinitionId, textValue: "i7" },
        { definitionId: optionDefinitionId, optionValue: "pink" },
      ],
    }),
  });
  assert.equal(invalidOption.status, 422);

  const noCategory = await app.request("/api/products", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      sku: "LAPTOP-04",
      name: "Laptop không danh mục",
      trackingMode: "none",
      barcodes: ["LAPTOP-04-BC"],
      specValues: [{ definitionId: requiredDefinitionId, textValue: "i5" }],
    }),
  });
  assert.equal(noCategory.status, 422);
  assert.equal((await noCategory.json()).error.code, "INVALID_SPEC_CATEGORY");
});
