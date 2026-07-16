import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import type { AccessStore } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import { registerPrintRoutes } from "../src/modules/print.js";
import { registerReportRoutes } from "../src/modules/reports.js";

const secret = "test-session-secret-that-is-at-least-32-characters";

class PermissionStore implements AuthStore, AccessStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();

  async findUserByEmail(email: string) { return this.users.find((user) => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.find((user) => user.id === id) ?? null; }
  async createSession(session: AuthSession) { this.sessions.set(session.tokenHash, session); }
  async findSession(hash: string) { return this.sessions.get(hash) ?? null; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async updatePassword() {}
  async listPermissions(userId: string) { return this.permissions.get(userId) ?? []; }
  async insertAudit() {}
}

test("report view permission cannot export or print", async () => {
  const store = new PermissionStore();
  store.users.push({
    id: "reporter",
    email: "reporter@example.test",
    fullName: "Nhân viên báo cáo",
    kind: "warehouse_user",
    warehouseId: "warehouse-a",
    passwordHash: await hashPassword("secure-password"),
    mustChangePassword: false,
    status: "active",
  });
  store.permissions.set("reporter", ["reports.view"]);
  let queries = 0;
  const pool = {
    async query() {
      queries += 1;
      return { rows: [{}], rowCount: 1 };
    },
  } as unknown as Pool;
  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerReportRoutes(app, store, store, pool, secret);
  registerPrintRoutes(app, store, store, pool, secret);
  const login = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "reporter@example.test", password: "secure-password" }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

  assert.equal((await app.request("/api/reports/dashboard", { headers: { cookie } })).status, 200);
  const queriesAfterView = queries;
  assert.equal((await app.request("/api/reports/inventory.csv", { headers: { cookie } })).status, 403);
  assert.equal((await app.request("/api/print/documents/document-a", { headers: { cookie } })).status, 403);
  assert.equal(queries, queriesAfterView);

  store.permissions.set("reporter", ["print.print"]);
  assert.equal((await app.request("/api/print/documents/document-a", { headers: { cookie } })).status, 200);
  assert.equal(queries, queriesAfterView + 2);
});
