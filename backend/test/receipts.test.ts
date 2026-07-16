import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import type { AccessStore, AuditEntry } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import {
  registerReceiptRoutes,
  validateReceiptLine,
  type Receipt,
  type ReceiptInput,
  type ReceiptStore,
} from "../src/modules/receipts.js";

const secret = "test-session-secret-that-is-at-least-32-characters";
const locationId = "00000000-0000-4000-8000-000000000001";
const productId = "00000000-0000-4000-8000-000000000002";

class MemoryReceiptStore implements AuthStore, AccessStore, ReceiptStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  audits: AuditEntry[] = [];
  receipts: Receipt[] = [];
  confirmWrites = 0;

  async findUserByEmail(email: string) { return this.users.find((user) => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.find((user) => user.id === id) ?? null; }
  async createSession(session: AuthSession) { this.sessions.set(session.tokenHash, session); }
  async findSession(hash: string) { return this.sessions.get(hash) ?? null; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async updatePassword() {}
  async listPermissions(userId: string) { return this.permissions.get(userId) ?? []; }
  async insertAudit(entry: AuditEntry) { this.audits.push(entry); }
  async defaultWarehouseId() { return "warehouse-a"; }
  async createReceipt(input: ReceiptInput) {
    const receipt: Receipt = {
      id: randomUUID(),
      warehouseId: input.warehouseId,
      documentNo: input.documentNo,
      status: "draft",
      lineCount: input.lines.length,
      confirmedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.receipts.push(receipt);
    return receipt;
  }
  async listReceipts(warehouseId: string | null, limit: number, offset: number) {
    const data = this.receipts.filter((receipt) => !warehouseId || receipt.warehouseId === warehouseId);
    return { data: data.slice(offset, offset + limit), total: data.length };
  }
  async confirmReceipt(warehouseId: string, receiptId: string) {
    const receipt = this.receipts.find((item) => item.warehouseId === warehouseId && item.id === receiptId);
    if (!receipt) throw Object.assign(new Error("not found"), { code: "RECEIPT_NOT_FOUND" });
    if (receipt.status === "confirmed") {
      return { documentId: receipt.id, movementCount: receipt.lineCount, alreadyConfirmed: true };
    }
    receipt.status = "confirmed";
    receipt.confirmedAt = new Date().toISOString();
    this.confirmWrites += 1;
    return { documentId: receipt.id, movementCount: receipt.lineCount, alreadyConfirmed: false };
  }
}

async function setup() {
  const store = new MemoryReceiptStore();
  const passwordHash = await hashPassword("secure-password");
  store.users.push({
    id: "admin-a",
    email: "admin@example.test",
    fullName: "Warehouse Admin",
    kind: "warehouse_admin",
    warehouseId: "warehouse-a",
    passwordHash,
    mustChangePassword: false,
    status: "active",
  });
  store.permissions.set("admin-a", ["receipts.view", "receipts.create", "receipts.approve"]);
  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerReceiptRoutes(app, store, store, store, secret);
  const login = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@example.test", password: "secure-password" }),
  });
  return { app, store, cookie: (login.headers.get("set-cookie") ?? "").split(";")[0] };
}

test("receipt line validation enforces none, lot, serial and expiry policies", () => {
  const base = { locationId, productId, quantity: 1 };

  assert.throws(() => validateReceiptLine({ trackingMode: "none", expiryManaged: false }, { ...base, lotCode: "LOT-A" }), /TRACKING_MISMATCH/);
  assert.throws(() => validateReceiptLine({ trackingMode: "lot", expiryManaged: true }, { ...base, lotCode: "LOT-A" }), /EXPIRY_REQUIRED/);
  assert.doesNotThrow(() => validateReceiptLine(
    { trackingMode: "lot", expiryManaged: true },
    { ...base, lotCode: "LOT-A", expiresAt: "2027-01-01" },
  ));
  assert.throws(() => validateReceiptLine({ trackingMode: "serial", expiryManaged: false }, { ...base, quantity: 2, serialCode: "SER-A" }), /SERIAL_QUANTITY/);
  assert.throws(() => validateReceiptLine({ trackingMode: "serial", expiryManaged: false }, base), /SERIAL_REQUIRED/);
});

test("receipt create, list and confirm are warehouse-scoped and idempotent", async () => {
  const { app, store, cookie } = await setup();
  const created = await app.request("/api/receipts", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      documentNo: "RCV-001",
      lines: [{ locationId, productId, quantity: 3 }],
    }),
  });
  assert.equal(created.status, 201);
  const receiptId = (await created.json()).receipt.id as string;

  const first = await app.request(`/api/receipts/${receiptId}/confirm`, { method: "POST", headers: { cookie } });
  const retry = await app.request(`/api/receipts/${receiptId}/confirm`, { method: "POST", headers: { cookie } });
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).result.alreadyConfirmed, true);
  assert.equal(store.confirmWrites, 1);

  const list = await app.request("/api/receipts?pageSize=10", { headers: { cookie } });
  assert.equal(list.status, 200);
  const body = await list.json();
  assert.equal(body.pagination.totalItems, 1);
  assert.equal(body.data[0].status, "confirmed");
  assert.equal(store.audits.length, 2);
});

test("receipt list never treats a warehouse user without scope as master", async () => {
  const { app, store } = await setup();
  const passwordHash = await hashPassword("secure-password");
  store.users.push({
    id: "unscoped-a",
    email: "unscoped@example.test",
    fullName: "Unscoped User",
    kind: "warehouse_user",
    warehouseId: null,
    passwordHash,
    mustChangePassword: false,
    status: "active",
  });
  store.permissions.set("unscoped-a", ["receipts.view"]);
  const login = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "unscoped@example.test", password: "secure-password" }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

  const response = await app.request("/api/receipts", { headers: { cookie } });
  assert.equal(response.status, 403);
});

test("receipt view permission cannot create or confirm a receipt", async () => {
  const { app, store, cookie } = await setup();
  const receipt = await store.createReceipt({
    warehouseId: "warehouse-a",
    documentNo: "VIEW-ONLY",
    lines: [{ locationId, productId, quantity: 1 }],
  });
  store.permissions.set("admin-a", ["receipts.view"]);

  assert.equal((await app.request("/api/receipts", { headers: { cookie } })).status, 200);
  assert.equal((await app.request("/api/receipts", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ documentNo: "BLOCKED", lines: [{ locationId, productId, quantity: 1 }] }),
  })).status, 403);
  assert.equal((await app.request(`/api/receipts/${receipt.id}/confirm`, {
    method: "POST",
    headers: { cookie },
  })).status, 403);
  assert.equal(store.receipts.length, 1);
  assert.equal(store.confirmWrites, 0);
  assert.equal(store.audits.length, 0);
});
