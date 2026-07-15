import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import {
  registerAuthRoutes,
  type AuthSession,
  type AuthStore,
  type AuthUser,
} from "../src/modules/auth.js";
import { hashPassword } from "../src/domain/password.js";

class MemoryAuthStore implements AuthStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();

  async findUserByEmail(email: string) {
    return this.users.find((user) => user.email === email) ?? null;
  }
  async findUserById(id: string) {
    return this.users.find((user) => user.id === id) ?? null;
  }
  async createSession(session: AuthSession) {
    this.sessions.set(session.tokenHash, session);
  }
  async findSession(tokenHash: string) {
    return this.sessions.get(tokenHash) ?? null;
  }
  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }
  async updatePassword(userId: string, passwordHash: string) {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (user) Object.assign(user, { passwordHash, mustChangePassword: false });
  }
}

async function setup(secureCookies = false) {
  const store = new MemoryAuthStore();
  store.users.push({
    id: "master-1",
    email: "master@example.test",
    fullName: "Master Admin",
    kind: "master_admin",
    warehouseId: null,
    passwordHash: await hashPassword("temporary-password"),
    mustChangePassword: true,
    status: "active",
  });
  const app = createApp();
  registerAuthRoutes(app, store, {
    sessionSecret: "test-session-secret-that-is-at-least-32-characters",
    secureCookies,
  });
  return { app, store };
}

test("master logs in with a protected session cookie", async () => {
  const { app } = await setup();
  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "MASTER@example.test",
      password: "temporary-password",
    }),
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/i);
  assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Lax/i);
  assert.equal((await response.json()).user.mustChangePassword, true);
});

test("production cookies are secure", async () => {
  const { app } = await setup(true);
  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "master@example.test",
      password: "temporary-password",
    }),
  });
  assert.match(response.headers.get("set-cookie") ?? "", /Secure/i);
});

test("login failure is generic and signup does not exist", async () => {
  const { app } = await setup();
  const failed = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "master@example.test",
      password: "wrong-password",
    }),
  });
  assert.equal(failed.status, 401);
  assert.equal((await failed.json()).error.code, "INVALID_CREDENTIALS");
  assert.equal((await app.request("/api/auth/signup")).status, 404);
});

test("login is rate limited after repeated failures", async () => {
  const { app } = await setup();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "master@example.test",
        password: "wrong-password",
      }),
    });
    assert.equal(response.status, 401);
  }
  const blocked = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "master@example.test",
      password: "wrong-password",
    }),
  });
  assert.equal(blocked.status, 429);
});

test("expired and revoked sessions are rejected", async () => {
  const { app, store } = await setup();
  const login = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "master@example.test",
      password: "temporary-password",
    }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  const session = [...store.sessions.values()][0];
  session.expiresAt = new Date(0);
  assert.equal(
    (await app.request("/api/auth/session", { headers: { cookie } })).status,
    401,
  );

  session.expiresAt = new Date(Date.now() + 60_000);
  store.sessions.clear();
  assert.equal(
    (await app.request("/api/auth/session", { headers: { cookie } })).status,
    401,
  );
});

test("temporary password can be changed and logout revokes the session", async () => {
  const { app } = await setup();
  const login = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "master@example.test",
      password: "temporary-password",
    }),
  });
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  const changed = await app.request("/api/auth/change-password", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ password: "new-secure-password" }),
  });
  assert.equal(changed.status, 204);

  const session = await app.request("/api/auth/session", {
    headers: { cookie },
  });
  assert.equal((await session.json()).user.mustChangePassword, false);

  assert.equal(
    (
      await app.request("/api/auth/logout", {
        method: "POST",
        headers: { cookie },
      })
    ).status,
    204,
  );
  assert.equal(
    (await app.request("/api/auth/session", { headers: { cookie } })).status,
    401,
  );
});
