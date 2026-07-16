import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import type { AccessStore, AuditEntry } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import {
  registerCatalogRoutes,
  type CatalogCategory,
  type CatalogStore,
  type CatalogUnit,
} from "../src/modules/catalog.js";

const secret = "test-session-secret-that-is-at-least-32-characters";

class MemoryCatalogStore implements AuthStore, AccessStore, CatalogStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  audits: AuditEntry[] = [];
  categories: CatalogCategory[] = [];
  units: CatalogUnit[] = [];
  referencedCategoryIds = new Set<string>();
  referencedUnitIds = new Set<string>();
  warehouseIds = ["warehouse-a"];

  async findUserByEmail(email: string) { return this.users.find((user) => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.find((user) => user.id === id) ?? null; }
  async createSession(session: AuthSession) { this.sessions.set(session.tokenHash, session); }
  async findSession(hash: string) { return this.sessions.get(hash) ?? null; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async updatePassword() {}
  async listPermissions(userId: string) { return this.permissions.get(userId) ?? []; }
  async insertAudit(entry: AuditEntry) { this.audits.push(entry); }
  async defaultWarehouseId() { return this.warehouseIds.length === 1 ? this.warehouseIds[0]! : null; }
  async listCategories(warehouseId: string | null) {
    const data = warehouseId ? this.categories.filter((item) => item.warehouseId === warehouseId) : this.categories;
    return { data, total: data.length };
  }
  async createCategory(input: Omit<CatalogCategory, "id" | "status">) {
    if (this.categories.some((item) => item.warehouseId === input.warehouseId && item.code === input.code)) {
      throw Object.assign(new Error("duplicate"), { code: "23505" });
    }
    const category: CatalogCategory = { ...input, id: randomUUID(), status: "active" };
    this.categories.push(category);
    return category;
  }
  async updateCategory(warehouseId: string, id: string, name: string) {
    const category = this.categories.find((item) => item.warehouseId === warehouseId && item.id === id);
    if (!category) return null;
    category.name = name;
    return category;
  }
  async setCategoryStatus(warehouseId: string, id: string, status: CatalogCategory["status"]) {
    const category = this.categories.find((item) => item.warehouseId === warehouseId && item.id === id);
    if (!category) return null;
    if (status === "inactive" && this.referencedCategoryIds.has(id)) throw new Error("REFERENCE_CONFLICT");
    category.status = status;
    return category;
  }
  async listUnits(warehouseId: string | null) {
    const data = warehouseId ? this.units.filter((item) => item.warehouseId === warehouseId) : this.units;
    return { data, total: data.length };
  }
  async findUnit(warehouseId: string, id: string) {
    return this.units.find((item) => item.warehouseId === warehouseId && item.id === id) ?? null;
  }
  async createUnit(input: Omit<CatalogUnit, "id" | "status">) {
    if (this.units.some((item) => item.warehouseId === input.warehouseId && item.code === input.code)) {
      throw Object.assign(new Error("duplicate"), { code: "23505" });
    }
    const unit: CatalogUnit = { ...input, id: randomUUID(), status: "active" };
    this.units.push(unit);
    return unit;
  }
  async updateUnit(warehouseId: string, id: string, name: string) {
    const unit = this.units.find((item) => item.warehouseId === warehouseId && item.id === id);
    if (!unit) return null;
    unit.name = name;
    return unit;
  }
  async setUnitStatus(warehouseId: string, id: string, status: CatalogUnit["status"]) {
    const unit = this.units.find((item) => item.warehouseId === warehouseId && item.id === id);
    if (!unit) return null;
    if (status === "inactive" && this.referencedUnitIds.has(id)) throw new Error("REFERENCE_CONFLICT");
    unit.status = status;
    return unit;
  }
}

async function setup() {
  const store = new MemoryCatalogStore();
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
  store.permissions.set("admin-a", [
    "catalog.categories.view", "catalog.categories.create", "catalog.categories.update", "catalog.categories.delete",
    "catalog.units.view", "catalog.units.create", "catalog.units.update", "catalog.units.delete",
  ]);
  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerCatalogRoutes(app, store, store, store, secret);
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

test("admin creates catalog category, base unit and conversion unit", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");

  const category = await app.request("/api/catalog/categories", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ code: "RAW", name: "Nguyên liệu" }),
  });
  assert.equal(category.status, 201);

  const base = await app.request("/api/catalog/units", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ code: "PCS", name: "Cái" }),
  });
  assert.equal(base.status, 201);
  const baseBody = await base.json();
  assert.equal(baseBody.unit.baseUnitId, null);
  assert.equal(baseBody.unit.conversionFactor, "1");

  const conversion = await app.request("/api/catalog/units", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ code: "BOX", name: "Thùng", baseUnitId: baseBody.unit.id, conversionFactor: 12 }),
  });
  assert.equal(conversion.status, 201);
  assert.equal((await conversion.json()).unit.conversionFactor, "12");

  const list = await app.request("/api/catalog/units", { headers: { cookie } });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).pagination.totalItems, 2);
  assert.equal(store.audits.length, 3);
});

test("catalog rejects invalid and ambiguous conversions", async () => {
  const { app } = await setup();
  const cookie = await login(app, "admin@example.test");

  const base = await app.request("/api/catalog/units", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ code: "PCS", name: "Cái" }),
  });
  const baseId = (await base.json()).unit.id;
  const conversion = await app.request("/api/catalog/units", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ code: "BOX", name: "Thùng", baseUnitId: baseId, conversionFactor: 12 }),
  });
  const conversionId = (await conversion.json()).unit.id;

  for (const body of [
    { code: "PACK", name: "Gói", conversionFactor: 10 },
    { code: "CASE", name: "Kiện", baseUnitId: baseId },
    { code: "LAYER", name: "Lớp", baseUnitId: conversionId, conversionFactor: 2 },
  ]) {
    const response = await app.request("/api/catalog/units", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 422);
  }
});

test("catalog view permissions cannot create category or unit", async () => {
  const { app, store } = await setup();
  store.permissions.set("denied-a", ["catalog.categories.view", "catalog.units.view"]);
  const cookie = await login(app, "denied@example.test");
  assert.equal((await app.request("/api/catalog/categories", { headers: { cookie } })).status, 200);
  assert.equal((await app.request("/api/catalog/units", { headers: { cookie } })).status, 200);
  for (const [path, body] of [
    ["/api/catalog/categories", { code: "NO", name: "Không tạo" }],
    ["/api/catalog/units", { code: "NO", name: "Không tạo" }],
  ] as const) {
    assert.equal((await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    })).status, 403);
  }
  assert.equal(store.audits.length, 0);
});

test("category and unit update/status are scoped and audited", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const category = await store.createCategory({ warehouseId: "warehouse-a", code: "CAT", name: "Danh mục cũ" });
  const unit = await store.createUnit({ warehouseId: "warehouse-a", code: "EA", name: "Đơn vị cũ", baseUnitId: null, conversionFactor: "1" });

  for (const [path, body] of [
    [`/api/catalog/categories/${category.id}`, { name: "Danh mục mới" }],
    [`/api/catalog/categories/${category.id}/status`, { status: "inactive" }],
    [`/api/catalog/units/${unit.id}`, { name: "Đơn vị mới" }],
    [`/api/catalog/units/${unit.id}/status`, { status: "inactive" }],
  ] as const) {
    assert.equal((await app.request(path, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    })).status, 200);
  }
  assert.equal(category.name, "Danh mục mới");
  assert.equal(category.status, "inactive");
  assert.equal(unit.name, "Đơn vị mới");
  assert.equal(unit.status, "inactive");
  assert.deepEqual(store.audits.map((entry) => entry.action), [
    "catalog.category.update", "catalog.category.status",
    "catalog.unit.update", "catalog.unit.status",
  ]);
});

test("catalog mutations reject permission, scope, validation and reference conflicts", async () => {
  const { app, store } = await setup();
  const adminCookie = await login(app, "admin@example.test");
  const deniedCookie = await login(app, "denied@example.test");
  const category = await store.createCategory({ warehouseId: "warehouse-a", code: "CAT", name: "Danh mục" });
  const unit = await store.createUnit({ warehouseId: "warehouse-a", code: "EA", name: "Đơn vị", baseUnitId: null, conversionFactor: "1" });
  store.referencedCategoryIds.add(category.id);
  store.referencedUnitIds.add(unit.id);
  store.permissions.set("denied-a", ["catalog.categories.view", "catalog.units.view"]);

  assert.equal((await app.request(`/api/catalog/categories/${category.id}`, {
    method: "PATCH", headers: { "content-type": "application/json", cookie: deniedCookie }, body: JSON.stringify({ name: "Bị chặn" }),
  })).status, 403);
  assert.equal((await app.request(`/api/catalog/categories/${category.id}`, {
    method: "PATCH", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ code: "NOT_ALLOWED" }),
  })).status, 422);
  assert.equal((await app.request(`/api/catalog/categories/${randomUUID()}`, {
    method: "PATCH", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ name: "Không có" }),
  })).status, 404);
  assert.equal((await app.request(`/api/catalog/categories/${category.id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ status: "inactive" }),
  })).status, 409);
  assert.equal((await app.request(`/api/catalog/units/${unit.id}/status`, {
    method: "PATCH", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ status: "inactive" }),
  })).status, 409);
  assert.equal(category.name, "Danh mục");
  assert.equal(category.status, "active");
  assert.equal(unit.status, "active");
  assert.equal(store.audits.length, 0);
});
