import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import type { AccessStore, AuditEntry } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import { registerPartnerRoutes, type Partner, type PartnerStore } from "../src/modules/partners.js";

const secret = "test-session-secret-that-is-at-least-32-characters";

class MemoryPartnerStore implements AuthStore, AccessStore, PartnerStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  audits: AuditEntry[] = [];
  partners: Partner[] = [];
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
  async listPartners(warehouseId: string | null) {
    const data = warehouseId ? this.partners.filter((item) => item.warehouseId === warehouseId) : this.partners;
    return { data, total: data.length };
  }
  async createPartner(input: Omit<Partner, "id" | "status">) {
    if (this.partners.some((item) => item.warehouseId === input.warehouseId && item.code === input.code)) {
      throw Object.assign(new Error("duplicate"), { code: "23505" });
    }
    const partner: Partner = { ...input, id: randomUUID(), status: "active" };
    this.partners.push(partner);
    return partner;
  }
  async updatePartner(warehouseId: string, id: string, input: Partial<Pick<Partner, "name" | "taxCode" | "phone" | "email" | "address">>) {
    const partner = this.partners.find((item) => item.warehouseId === warehouseId && item.id === id);
    if (!partner) return null;
    Object.assign(partner, input);
    return partner;
  }
  async setPartnerStatus(warehouseId: string, id: string, status: Partner["status"]) {
    const partner = this.partners.find((item) => item.warehouseId === warehouseId && item.id === id);
    if (!partner) return null;
    partner.status = status;
    return partner;
  }
}

async function setup() {
  const store = new MemoryPartnerStore();
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
      id: "admin-b",
      email: "admin-b@example.test",
      fullName: "Warehouse Admin B",
      kind: "warehouse_admin",
      warehouseId: "warehouse-b",
      passwordHash,
      mustChangePassword: false,
      status: "active",
    },
  );
  store.permissions.set("admin-a", ["partners.view", "partners.create", "partners.update", "partners.delete"]);
  store.permissions.set("admin-b", ["partners.view", "partners.create", "partners.update", "partners.delete"]);
  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerPartnerRoutes(app, store, store, store, secret);
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

test("admin creates, updates and disables a scoped partner", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");

  const created = await app.request("/api/partners", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ code: "SUP-1", name: "Nhà cung cấp 1", kind: "supplier", taxCode: "TAX-1", phone: "0900000000", email: "sup@example.test", address: "HCM" }),
  });
  assert.equal(created.status, 201);
  const partnerId = (await created.json()).partner.id;

  const updated = await app.request(`/api/partners/${partnerId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Nhà cung cấp đã sửa", phone: "0911111111" }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).partner.name, "Nhà cung cấp đã sửa");

  const disabled = await app.request(`/api/partners/${partnerId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ status: "inactive" }),
  });
  assert.equal(disabled.status, 200);
  assert.equal((await disabled.json()).partner.status, "inactive");

  assert.equal(store.audits.length, 3);
});

test("partners reject duplicate code and cannot cross warehouse", async () => {
  const { app, store } = await setup();
  const cookieA = await login(app, "admin@example.test");
  const cookieB = await login(app, "admin-b@example.test");

  const created = await app.request("/api/partners", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieA },
    body: JSON.stringify({ code: "CUS-1", name: "Khách hàng 1", kind: "customer" }),
  });
  assert.equal(created.status, 201);
  const partnerId = (await created.json()).partner.id;

  const duplicate = await app.request("/api/partners", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookieA },
    body: JSON.stringify({ code: "CUS-1", name: "Khách hàng trùng", kind: "customer" }),
  });
  assert.equal(duplicate.status, 409);

  const crossWarehouse = await app.request(`/api/partners/${partnerId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: cookieB },
    body: JSON.stringify({ name: "Không được sửa" }),
  });
  assert.equal(crossWarehouse.status, 404);

  store.partners.push({ id: randomUUID(), warehouseId: "warehouse-b", code: "CUS-1", name: "Khách hàng kho B", kind: "customer", taxCode: null, phone: null, email: null, address: null, status: "active" });
  const listB = await app.request("/api/partners", { headers: { cookie: cookieB } });
  assert.equal((await listB.json()).pagination.totalItems, 1);
});

test("partner view permission cannot create, update or disable", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  store.permissions.set("admin-a", ["partners.view"]);
  store.partners.push({ id: "partner-a", warehouseId: "warehouse-a", code: "CUS-1", name: "Khách hàng", kind: "customer", taxCode: null, phone: null, email: null, address: null, status: "active" });
  assert.equal((await app.request("/api/partners", { headers: { cookie } })).status, 200);
  const mutations = [
    app.request("/api/partners", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ code: "NO", name: "Không tạo", kind: "customer" }) }),
    app.request("/api/partners/partner-a", { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ name: "Không sửa" }) }),
    app.request("/api/partners/partner-a/status", { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ status: "inactive" }) }),
  ];
  for (const response of await Promise.all(mutations)) assert.equal(response.status, 403);
  assert.equal(store.partners[0]?.name, "Khách hàng");
  assert.equal(store.partners[0]?.status, "active");
  assert.equal(store.audits.length, 0);
});
