import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import type { AccessStore, AuditEntry } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import {
  registerInventoryRoutes,
  type InventoryBalance,
  type InventoryLot,
  type InventoryMovement,
  type InventorySerial,
  type InventoryStore,
  type InventoryFilters,
} from "../src/modules/inventory.js";

const secret = "test-session-secret-that-is-at-least-32-characters";

class MemoryInventoryStore implements AuthStore, AccessStore, InventoryStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  audits: AuditEntry[] = [];
  scopes: Array<string | null> = [];
  balances: InventoryBalance[] = [
    { warehouseId: "warehouse-a", locationId: "loc-a", locationCode: "A-01", productId: "prod-a", sku: "SKU-A", productName: "A", lotCode: "LOT-A", serialCode: null, onHand: 10, committed: 3, available: 7 },
    { warehouseId: "warehouse-b", locationId: "loc-b", locationCode: "B-01", productId: "prod-b", sku: "SKU-B", productName: "B", lotCode: null, serialCode: null, onHand: 20, committed: 0, available: 20 },
  ];

  async findUserByEmail(email: string) { return this.users.find((user) => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.find((user) => user.id === id) ?? null; }
  async createSession(session: AuthSession) { this.sessions.set(session.tokenHash, session); }
  async findSession(hash: string) { return this.sessions.get(hash) ?? null; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async updatePassword() {}
  async listPermissions(userId: string) { return this.permissions.get(userId) ?? []; }
  async insertAudit(entry: AuditEntry) { this.audits.push(entry); }
  page<T>(rows: T[], limit: number, offset: number) { return { data: rows.slice(offset, offset + limit), total: rows.length }; }
  async listBalances(warehouseId: string | null, filters: InventoryFilters, limit: number, offset: number) {
    this.scopes.push(warehouseId);
    const rows = this.balances.filter((row) => (!warehouseId || row.warehouseId === warehouseId) && (!filters.q || row.sku.includes(filters.q)));
    return this.page(rows, limit, offset);
  }
  async listLots(warehouseId: string | null, _filters: InventoryFilters, limit: number, offset: number) {
    this.scopes.push(warehouseId);
    return this.page<InventoryLot>([{ id: "lot-a", productId: "prod-a", sku: "SKU-A", productName: "A", lotCode: "LOT-A", manufacturedAt: null, expiresAt: "2027-01-01", onHand: 10 }], limit, offset);
  }
  async listSerials(warehouseId: string | null, _filters: InventoryFilters, limit: number, offset: number) {
    this.scopes.push(warehouseId);
    return this.page<InventorySerial>([{ id: "serial-a", productId: "prod-a", sku: "SKU-A", productName: "A", serialCode: "SER-A", status: "in_stock", locationCode: "A-01", onHand: 1 }], limit, offset);
  }
  async listMovements(warehouseId: string | null, _filters: InventoryFilters, limit: number, offset: number) {
    this.scopes.push(warehouseId);
    return this.page<InventoryMovement>([{ id: "move-a", documentNo: "RCV-A", documentType: "receipt", locationCode: "A-01", productId: "prod-a", sku: "SKU-A", productName: "A", lotCode: "LOT-A", serialCode: null, quantityDelta: 10, createdAt: "2026-07-15T00:00:00.000Z" }], limit, offset);
  }
}

async function setup() {
  const store = new MemoryInventoryStore();
  const passwordHash = await hashPassword("secure-password");
  store.users.push({ id: "admin-a", email: "admin@example.test", fullName: "Admin", kind: "warehouse_admin", warehouseId: "warehouse-a", passwordHash, mustChangePassword: false, status: "active" });
  store.permissions.set("admin-a", ["stock.manage"]);
  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerInventoryRoutes(app, store, store, store, secret);
  const login = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@example.test", password: "secure-password" }) });
  return { app, store, cookie: (login.headers.get("set-cookie") ?? "").split(";")[0] };
}

test("inventory returns scoped on-hand, committed and available totals", async () => {
  const { app, store, cookie } = await setup();
  const response = await app.request("/api/inventory/balances?pageSize=10", { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.pagination.totalItems, 1);
  assert.deepEqual(body.data[0], store.balances[0]);
  assert.deepEqual(store.scopes, ["warehouse-a"]);
});

test("inventory exposes paginated lots, serials and immutable movement history", async () => {
  const { app, cookie } = await setup();
  for (const path of ["lots", "serials", "movements"]) {
    const response = await app.request(`/api/inventory/${path}?page=1&pageSize=1`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.length, 1);
    assert.equal(body.pagination.totalPages, 1);
  }
});

test("inventory bounds filters and pagination", async () => {
  const { app, cookie } = await setup();
  assert.equal((await app.request(`/api/inventory/balances?q=${"x".repeat(81)}`, { headers: { cookie } })).status, 422);
  assert.equal((await app.request("/api/inventory/balances?pageSize=201", { headers: { cookie } })).status, 422);
});
