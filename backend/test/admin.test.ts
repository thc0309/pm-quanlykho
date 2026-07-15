import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import { registerAccessRoutes, type AccessStore, type AuditEntry } from "../src/modules/access.js";
import {
  registerAdminRoutes,
  type AdminRole,
  type AdminStore,
  type AdminUser,
} from "../src/modules/admin.js";
import {
  registerAuthRoutes,
  type AuthSession,
  type AuthStore,
  type AuthUser,
} from "../src/modules/auth.js";

const secret = "test-session-secret-that-is-at-least-32-characters";

class MemoryAdminStore implements AuthStore, AccessStore, AdminStore {
  authUsers: AuthUser[] = [];
  users: AdminUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  roles: AdminRole[] = [];
  userRoles = new Map<string, string[]>();
  audits: AuditEntry[] = [];

  async findUserByEmail(email: string) {
    return this.authUsers.find((user) => user.email === email) ?? null;
  }
  async findUserById(id: string) {
    return this.authUsers.find((user) => user.id === id) ?? null;
  }
  async createSession(session: AuthSession) {
    this.sessions.set(session.tokenHash, session);
  }
  async findSession(hash: string) {
    return this.sessions.get(hash) ?? null;
  }
  async deleteSession(hash: string) {
    this.sessions.delete(hash);
  }
  async updatePassword() {}
  async listPermissions(userId: string) {
    return this.permissions.get(userId) ?? [];
  }
  async insertAudit(entry: AuditEntry) {
    this.audits.push(entry);
  }
  async listUsers(warehouseId: string) {
    const data = this.users.filter((user) => user.warehouseId === warehouseId);
    return { data, total: data.length };
  }
  async createUser(input: Omit<AdminUser, "id" | "status"> & { passwordHash: string }) {
    const user: AdminUser = { ...input, id: `user-${this.users.length + 1}`, status: "active" };
    this.users.push(user);
    return user;
  }
  async findUserWarehouse(userId: string) {
    return this.users.find((user) => user.id === userId)?.warehouseId ?? null;
  }
  async setUserStatus(userId: string, status: "active" | "inactive") {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (!user) return null;
    user.status = status;
    return user;
  }
  async listRoles(warehouseId: string) {
    const data = this.roles.filter((role) => role.warehouseId === warehouseId);
    return { data, total: data.length };
  }
  async createRole(input: Omit<AdminRole, "id">) {
    const role = { ...input, id: `role-${this.roles.length + 1}` };
    this.roles.push(role);
    return role;
  }
  async findRoleWarehouses(roleIds: string[]) {
    return this.roles.filter((role) => roleIds.includes(role.id)).map((role) => role.warehouseId);
  }
  async setUserRoles(userId: string, roleIds: string[]) {
    this.userRoles.set(userId, roleIds);
  }
}

async function setup() {
  const store = new MemoryAdminStore();
  const passwordHash = await hashPassword("secure-password");
  store.authUsers.push(
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
  store.permissions.set("admin-a", ["admin.access.manage"]);
  store.users.push({
    id: "outside-user",
    email: "outside@example.test",
    fullName: "Outside",
    kind: "warehouse_user",
    warehouseId: "warehouse-b",
    status: "active",
  });

  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerAccessRoutes(app, store, store, secret);
  registerAdminRoutes(app, store, store, store, secret);
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

test("warehouse admin creates picker/checker roles and a scoped user", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");

  for (const role of [
    { code: "picker", name: "Nhân viên soạn", permissions: ["outbound.pick"] },
    { code: "checker", name: "Nhân viên kiểm", permissions: ["outbound.check", "outbound.ship"] },
  ]) {
    assert.equal(
      (await app.request("/api/admin/roles", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify(role),
      })).status,
      201,
    );
  }

  const created = await app.request("/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ email: "picker@example.test", fullName: "Picker One" }),
  });
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.user.warehouseId, "warehouse-a");
  assert.equal(typeof body.temporaryPassword, "string");
  assert.equal("passwordHash" in body.user, false);

  const assign = await app.request(`/api/admin/users/${body.user.id}/roles`, {
    method: "PUT",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ roleIds: store.roles.map((role) => role.id) }),
  });
  assert.equal(assign.status, 204);
  assert.equal(store.audits.length, 4);
});

test("denied user cannot administer access", async () => {
  const { app } = await setup();
  const cookie = await login(app, "denied@example.test");
  assert.equal((await app.request("/api/admin/users", { headers: { cookie } })).status, 403);
});

test("warehouse admin cannot disable a user in another warehouse", async () => {
  const { app } = await setup();
  const cookie = await login(app, "admin@example.test");
  const response = await app.request("/api/admin/users/outside-user/status", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ status: "inactive" }),
  });
  assert.equal(response.status, 403);
});
