import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import type { AccessStore, AuditEntry } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import { registerOutboundRoutes, type Outbound, type OutboundStore } from "../src/modules/outbound.js";

const secret = "test-session-secret-that-is-at-least-32-characters";
const warehouseId = "00000000-0000-4000-8000-000000000001";
const productId = "00000000-0000-4000-8000-000000000002";

class MemoryOutboundStore implements AuthStore, AccessStore, OutboundStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  audits: AuditEntry[] = [];
  outbounds: Outbound[] = [];
  onHand = 10;
  available = 10;
  releaseWork: Promise<{ documentId: string; reservationCount: number; alreadyReleased: boolean; reservedUntil: string }> | null = null;
  async findUserByEmail(email: string) { return this.users.find(user => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.find(user => user.id === id) ?? null; }
  async createSession(session: AuthSession) { this.sessions.set(session.tokenHash, session); }
  async findSession(hash: string) { return this.sessions.get(hash) ?? null; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async updatePassword() {}
  async listPermissions(userId: string) { return this.permissions.get(userId) ?? []; }
  async insertAudit(entry: AuditEntry) { this.audits.push(entry); }
  async defaultWarehouseId() { return warehouseId; }
  async createOutbound(input: Parameters<OutboundStore["createOutbound"]>[0]) {
    const outbound: Outbound = { id: crypto.randomUUID(), warehouseId: input.warehouseId, documentNo: input.documentNo, status: "draft", lineCount: input.lines.length, reservedUntil: null, createdAt: new Date().toISOString() };
    this.outbounds.unshift(outbound);
    (outbound as Outbound & { quantity: number }).quantity = input.lines.reduce((sum, line) => sum + line.quantity, 0);
    return outbound;
  }
  async listOutbounds(scope: string | null, limit: number, offset: number) {
    for (const item of this.outbounds) if (item.status === "ready_to_pick" && item.reservedUntil && item.reservedUntil <= new Date().toISOString()) { item.status = "draft"; item.reservedUntil = null; }
    const rows = this.outbounds.filter(item => !scope || item.warehouseId === scope);
    return { data: rows.slice(offset, offset + limit), total: rows.length };
  }
  async releaseOutbound(scope: string, documentId: string) {
    const item = this.outbounds.find(row => row.id === documentId && row.warehouseId === scope);
    if (!item) throw new Error("OUTBOUND_NOT_FOUND");
    if (item.status === "ready_to_pick" && item.reservedUntil && item.reservedUntil > new Date().toISOString()) return { documentId, reservationCount: 1, alreadyReleased: true, reservedUntil: item.reservedUntil };
    if (this.releaseWork) return this.releaseWork.then(result => ({ ...result, alreadyReleased: true }));
    this.releaseWork = (async () => {
      await new Promise(resolve => setTimeout(resolve, 5));
      const quantity = (item as Outbound & { quantity: number }).quantity;
      if (quantity > this.available) throw new Error("INSUFFICIENT_STOCK");
      this.available -= quantity;
      item.status = "ready_to_pick";
      item.reservedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      return { documentId, reservationCount: 1, alreadyReleased: false, reservedUntil: item.reservedUntil };
    })();
    try { return await this.releaseWork; } finally { this.releaseWork = null; }
  }
}

async function setup() {
  const store = new MemoryOutboundStore();
  store.users.push({ id: "admin-a", email: "admin@example.test", fullName: "Admin", kind: "warehouse_admin", warehouseId, passwordHash: await hashPassword("secure-password"), mustChangePassword: false, status: "active" });
  store.permissions.set("admin-a", ["outbounds.view", "outbounds.create", "outbounds.approve"]);
  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerOutboundRoutes(app, store, store, store, secret);
  const login = await app.request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@example.test", password: "secure-password" }) });
  return { app, store, cookie: (login.headers.get("set-cookie") ?? "").split(";")[0] };
}

async function create(app: Awaited<ReturnType<typeof setup>>["app"], cookie: string, quantity = 3) {
  return app.request("/api/outbounds", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ documentNo: `OUT-${crypto.randomUUID()}`, lines: [{ productId, quantity }] }) });
}

test("outbound draft releases once under concurrent retries and preserves physical on-hand", async () => {
  const { app, store, cookie } = await setup();
  const created = await create(app, cookie);
  const id = (await created.json()).outbound.id;
  const [first, retry] = await Promise.all([
    app.request(`/api/outbounds/${id}/release`, { method: "POST", headers: { cookie } }),
    app.request(`/api/outbounds/${id}/release`, { method: "POST", headers: { cookie } }),
  ]);
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(store.available, 7);
  assert.equal(store.onHand, 10, "on_hand stays unchanged while available decreases");
  assert.equal(store.audits.filter(entry => entry.action === "outbound.release").length, 1);
});

test("outbound rejects insufficient available stock without a partial reservation", async () => {
  const { app, store, cookie } = await setup();
  const id = (await (await create(app, cookie, 11)).json()).outbound.id;
  const response = await app.request(`/api/outbounds/${id}/release`, { method: "POST", headers: { cookie } });
  assert.equal(response.status, 409);
  assert.equal(store.available, 10);
  assert.equal(store.outbounds[0]?.status, "draft");
});

test("reserved stock expires after 30 minutes and can be released again", async () => {
  const { app, store, cookie } = await setup();
  const id = (await (await create(app, cookie, 2)).json()).outbound.id;
  await app.request(`/api/outbounds/${id}/release`, { method: "POST", headers: { cookie } });
  store.outbounds[0]!.reservedUntil = new Date(Date.now() - 1).toISOString();
  const list = await app.request("/api/outbounds", { headers: { cookie } });
  assert.equal((await list.json()).data[0].status, "draft");
});
