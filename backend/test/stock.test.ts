import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import type { AccessStore, AuditEntry } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import {
  registerStockRoutes,
  type StockBalance,
  type StockMovementInput,
  type StockStore,
} from "../src/modules/stock.js";

const secret = "test-session-secret-that-is-at-least-32-characters";

class MemoryStockStore implements AuthStore, AccessStore, StockStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  audits: AuditEntry[] = [];
  balances = new Map<string, StockBalance>();
  movements: StockMovementInput[] = [];
  serials = new Set<string>();
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
  async postMovements(input: StockMovementInput) {
    const nextBalances = new Map(this.balances);
    const nextSerials = new Set(this.serials);

    for (const line of input.lines) {
      if (line.serialCode && line.quantityDelta > 0) {
        const serialKey = `${input.warehouseId}:${line.productId}:${line.serialCode}`;
        if (nextSerials.has(serialKey)) throw Object.assign(new Error("duplicate serial"), { code: "DUPLICATE_SERIAL" });
        nextSerials.add(serialKey);
      }

      const key = `${input.warehouseId}:${line.locationId}:${line.productId}:${line.lotCode ?? ""}:${line.serialCode ?? ""}`;
      const current = nextBalances.get(key) ?? {
        warehouseId: input.warehouseId,
        locationId: line.locationId,
        productId: line.productId,
        lotCode: line.lotCode ?? null,
        serialCode: line.serialCode ?? null,
        onHand: 0,
      };
      const onHand = current.onHand + line.quantityDelta;
      if (onHand < 0) throw Object.assign(new Error("negative stock"), { code: "NEGATIVE_STOCK" });
      nextBalances.set(key, { ...current, onHand });
    }

    this.balances = nextBalances;
    this.serials = nextSerials;
    this.movements.push(input);
    return { documentId: randomUUID(), movementCount: input.lines.length };
  }
  async listBalances(warehouseId: string | null, limit: number, offset: number) {
    const data = [...this.balances.values()].filter((item) => !warehouseId || item.warehouseId === warehouseId);
    return { data: data.slice(offset, offset + limit), total: data.length };
  }
}

async function setup() {
  const store = new MemoryStockStore();
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
  store.permissions.set("admin-a", ["stock.manage"]);
  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerStockRoutes(app, store, store, store, secret);
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

test("stock movements update balances for none, lot and serial keys", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");

  const receipt = await app.request("/api/stock/movements", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      documentNo: "RCV-1",
      documentType: "receipt",
      lines: [
        { locationId: "loc-a", productId: "prod-none", quantityDelta: 10 },
        { locationId: "loc-a", productId: "prod-lot", quantityDelta: 5, lotCode: "LOT-A", expiresAt: "2026-12-31" },
        { locationId: "loc-a", productId: "prod-serial", quantityDelta: 1, serialCode: "SER-A" },
      ],
    }),
  });
  assert.equal(receipt.status, 201);
  assert.equal((await receipt.json()).result.movementCount, 3);

  const issue = await app.request("/api/stock/movements", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      documentNo: "ISS-1",
      documentType: "issue",
      lines: [
        { locationId: "loc-a", productId: "prod-none", quantityDelta: -3 },
        { locationId: "loc-a", productId: "prod-lot", quantityDelta: -2, lotCode: "LOT-A" },
        { locationId: "loc-a", productId: "prod-serial", quantityDelta: -1, serialCode: "SER-A" },
      ],
    }),
  });
  assert.equal(issue.status, 201);

  const balances = await app.request("/api/stock/balances?pageSize=10", { headers: { cookie } });
  assert.equal(balances.status, 200);
  const body = await balances.json();
  assert.equal(body.pagination.totalItems, 3);
  assert.deepEqual(
    body.data.map((item: StockBalance) => [item.productId, item.lotCode, item.serialCode, item.onHand]).sort(),
    [
      ["prod-lot", "LOT-A", null, 3],
      ["prod-none", null, null, 7],
      ["prod-serial", null, "SER-A", 0],
    ],
  );
  assert.equal(store.audits.length, 2);
});

test("stock transaction rolls back when any line would go negative", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");

  const response = await app.request("/api/stock/movements", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      documentNo: "BAD-1",
      documentType: "adjustment",
      lines: [
        { locationId: "loc-a", productId: "prod-ok", quantityDelta: 2 },
        { locationId: "loc-a", productId: "prod-bad", quantityDelta: -1 },
      ],
    }),
  });

  assert.equal(response.status, 409);
  assert.equal(store.balances.size, 0);
  assert.equal(store.movements.length, 0);
});

test("stock rejects duplicate serial receipts and concurrent negative writes", async () => {
  const { app } = await setup();
  const cookie = await login(app, "admin@example.test");

  const receiveSerial = () => app.request("/api/stock/movements", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      documentNo: `SER-${randomUUID()}`,
      documentType: "receipt",
      lines: [{ locationId: "loc-a", productId: "prod-serial", quantityDelta: 1, serialCode: "SER-DUP" }],
    }),
  });

  assert.equal((await receiveSerial()).status, 201);
  assert.equal((await receiveSerial()).status, 409);

  const seed = await app.request("/api/stock/movements", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      documentNo: "RCV-CONCURRENT",
      documentType: "receipt",
      lines: [{ locationId: "loc-a", productId: "prod-none", quantityDelta: 1 }],
    }),
  });
  assert.equal(seed.status, 201);

  const issue = (documentNo: string) => app.request("/api/stock/movements", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      documentNo,
      documentType: "issue",
      lines: [{ locationId: "loc-a", productId: "prod-none", quantityDelta: -1 }],
    }),
  });

  const results = await Promise.all([issue("ISS-A"), issue("ISS-B")]);
  assert.deepEqual(results.map((response) => response.status).sort(), [201, 409]);
});

test("stock management requires permission", async () => {
  const { app } = await setup();
  const cookie = await login(app, "denied@example.test");
  const response = await app.request("/api/stock/balances", { headers: { cookie } });
  assert.equal(response.status, 403);
});
