import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import type { AccessStore, AuditEntry } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import {
  registerLocationRoutes,
  type LocationStore,
  type WarehouseLocation,
} from "../src/modules/locations.js";

const secret = "test-session-secret-that-is-at-least-32-characters";

class MemoryLocationStore implements AuthStore, AccessStore, LocationStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  audits: AuditEntry[] = [];
  locations: WarehouseLocation[] = [];
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
  async list(warehouseId: string | null) { return warehouseId ? this.locations.filter((item) => item.warehouseId === warehouseId) : this.locations; }
  async create(input: Omit<WarehouseLocation, "id" | "status">) {
    if (this.locations.some((item) => item.warehouseId === input.warehouseId && (item.code === input.code || item.barcode === input.barcode))) throw Object.assign(new Error("duplicate"), { code: "23505" });
    const location: WarehouseLocation = { ...input, id: `location-${this.locations.length + 1}`, status: "active" };
    this.locations.push(location);
    return location;
  }
  async findByBarcode(warehouseId: string, barcode: string) {
    return this.locations.find((item) => item.warehouseId === warehouseId && item.barcode === barcode) ?? null;
  }
}

async function setup() {
  const store = new MemoryLocationStore();
  store.users.push({
    id: "admin-a", email: "admin@example.test", fullName: "Warehouse Admin",
    kind: "warehouse_admin", warehouseId: "warehouse-a",
    passwordHash: await hashPassword("secure-password"), mustChangePassword: false, status: "active",
  }, {
    id: "master", email: "master@example.test", fullName: "Master Admin",
    kind: "master_admin", warehouseId: null,
    passwordHash: await hashPassword("secure-password"), mustChangePassword: false, status: "active",
  });
  store.permissions.set("admin-a", ["locations.view", "locations.create"]);
  store.locations.push({ id: "foreign", warehouseId: "warehouse-b", code: "B-01", barcode: "FOREIGN-SCAN", name: "Kho B", type: "storage", status: "active" });
  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerLocationRoutes(app, store, store, store, secret);
  const response = await app.request("/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.test", password: "secure-password" }),
  });
  return { app, store, cookie: (response.headers.get("set-cookie") ?? "").split(";")[0] };
}

async function login(app: ReturnType<typeof createApp>, email: string) {
  const response = await app.request("/api/auth/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "secure-password" }),
  });
  return (response.headers.get("set-cookie") ?? "").split(";")[0];
}

test("admin creates all location types and duplicate or invalid input is rejected", async () => {
  const { app, store, cookie } = await setup();
  for (const [type, code] of [["storage", "ST-01"], ["staging", "SG-01"], ["shipping", "SH-01"]]) {
    const response = await app.request("/api/locations", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ code, barcode: `SCAN-${code}`, name: code, type }),
    });
    assert.equal(response.status, 201);
  }
  for (const body of [
    { code: "ST-01", barcode: "OTHER", name: "Duplicate code", type: "storage" },
    { code: "OTHER", barcode: "SCAN-ST-01", name: "Duplicate barcode", type: "storage" },
  ]) {
    assert.equal((await app.request("/api/locations", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) })).status, 409);
  }
  assert.equal((await app.request("/api/locations", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ code: "X", barcode: "X", name: "X", type: "office" }) })).status, 422);
  assert.equal(store.audits.length, 3);
});

test("barcode lookup cannot cross warehouse", async () => {
  const { app, cookie } = await setup();
  await app.request("/api/locations", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ code: "A-01", barcode: "OWN-SCAN", name: "Kho A", type: "storage" }) });
  assert.equal((await app.request("/api/locations/lookup/FOREIGN-SCAN", { headers: { cookie } })).status, 404);
  const found = await app.request("/api/locations/lookup/OWN-SCAN", { headers: { cookie } });
  assert.equal(found.status, 200);
  assert.equal((await found.json()).location.warehouseId, "warehouse-a");
});

test("master can list locations across warehouses", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "master@example.test");
  store.locations.push({ id: "own", warehouseId: "warehouse-a", code: "A-01", barcode: "OWN-SCAN", name: "Kho A", type: "storage", status: "active" });

  const response = await app.request("/api/locations", { headers: { cookie } });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.map((item: WarehouseLocation) => item.id), ["foreign", "own"]);
});

test("location view permission cannot create a location", async () => {
  const { app, store, cookie } = await setup();
  store.permissions.set("admin-a", ["locations.view"]);
  assert.equal((await app.request("/api/locations", { headers: { cookie } })).status, 200);
  const response = await app.request("/api/locations", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ code: "NO-01", barcode: "NO-SCAN", name: "Không tạo", type: "storage" }),
  });
  assert.equal(response.status, 403);
  assert.equal(store.audits.length, 0);
});
