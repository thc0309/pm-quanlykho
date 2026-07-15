import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import {
  auditChange,
  requireAccess,
  type AccessStore,
  type AuditEntry,
} from "../src/modules/access.js";
import {
  registerAuthRoutes,
  type AuthSession,
  type AuthStore,
  type AuthUser,
} from "../src/modules/auth.js";

const secret = "test-session-secret-that-is-at-least-32-characters";

class MemoryStore implements AuthStore, AccessStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  audits: AuditEntry[] = [];

  async findUserByEmail(email: string) {
    return this.users.find((user) => user.email === email) ?? null;
  }
  async findUserById(id: string) {
    return this.users.find((user) => user.id === id) ?? null;
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
}

async function setup() {
  const store = new MemoryStore();
  const passwordHash = await hashPassword("secure-password");
  store.users.push(
    {
      id: "master",
      email: "master@example.test",
      fullName: "Master",
      kind: "master_admin",
      warehouseId: null,
      passwordHash,
      mustChangePassword: false,
      status: "active",
    },
    {
      id: "picker",
      email: "picker@example.test",
      fullName: "Picker",
      kind: "warehouse_user",
      warehouseId: "warehouse-a",
      passwordHash,
      mustChangePassword: false,
      status: "active",
    },
  );
  store.permissions.set("picker", ["outbound.pick"]);

  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  app.get("/__access/:warehouseId/:permission", async (c) => {
    const actor = await requireAccess(c, store, store, secret, {
      permission: c.req.param("permission"),
      warehouseId: c.req.param("warehouseId"),
    });
    return c.json({ userId: actor.user.id });
  });
  app.post("/__change/:warehouseId", async (c) => {
    const actor = await requireAccess(c, store, store, secret, {
      permission: "outbound.pick",
      warehouseId: c.req.param("warehouseId"),
    });
    await auditChange(store, actor, {
      action: "outbound.pick",
      entityType: "outbound",
      entityId: "11111111-1111-4111-8111-111111111111",
    });
    return c.body(null, 204);
  });
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

test("access requires authentication", async () => {
  const { app } = await setup();
  assert.equal((await app.request("/__access/warehouse-a/outbound.pick")).status, 401);
});

test("warehouse user is isolated and permission checked", async () => {
  const { app } = await setup();
  const cookie = await login(app, "picker@example.test");
  assert.equal(
    (await app.request("/__access/warehouse-a/outbound.pick", { headers: { cookie } })).status,
    200,
  );
  assert.equal(
    (await app.request("/__access/warehouse-b/outbound.pick", { headers: { cookie } })).status,
    403,
  );
  assert.equal(
    (await app.request("/__access/warehouse-a/outbound.ship", { headers: { cookie } })).status,
    403,
  );
});

test("master scope crosses warehouses", async () => {
  const { app } = await setup();
  const cookie = await login(app, "master@example.test");
  assert.equal(
    (await app.request("/__access/warehouse-b/outbound.ship", { headers: { cookie } })).status,
    200,
  );
});

test("protected change records actor, action and target", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "picker@example.test");
  assert.equal(
    (await app.request("/__change/warehouse-a", { method: "POST", headers: { cookie } })).status,
    204,
  );
  assert.deepEqual(store.audits[0], {
    warehouseId: "warehouse-a",
    actorUserId: "picker",
    action: "outbound.pick",
    entityType: "outbound",
    entityId: "11111111-1111-4111-8111-111111111111",
    reason: null,
    metadata: {},
  });
});
