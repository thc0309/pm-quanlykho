import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import { registerAccessRoutes, type AccessStore, type AuditEntry } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import { remainingReturnQuantity, returnDelta } from "../src/modules/returns.js";
import { registerReturnRoutes } from "../src/modules/returns.js";

test("customer and supplier returns reverse original movement direction", () => {
  assert.equal(returnDelta("customer", 2), 2);
  assert.equal(returnDelta("supplier", 2), -2);
});

test("draft and confirmed claims reduce remaining return quantity", () => {
  assert.equal(remainingReturnQuantity(6, 4), 2);
  assert.equal(remainingReturnQuantity(6, 7), 0);
});

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

class FakeReturnPool {
  async connect() {
    throw new Error("connect should not be called in lookup tests");
  }

  async query(sql: string, params: unknown[] = []) {
    if (sql.includes(`FROM stock_documents d`) && sql.includes(`document_no AS "documentNo"`)) {
      assert.equal(params[1], "receipt");
      return {
        rows: [{
          id: "doc-1",
          documentNo: "RC-001",
          partnerName: "Nhà cung cấp A",
          confirmedAt: "2026-07-17T05:00:00.000Z",
        }],
        rowCount: 1,
      };
    }

    if (sql.includes(`SELECT document_type AS "documentType"`)) {
      assert.equal(params[0], "doc-1");
      return { rows: [{ documentType: "receipt" }], rowCount: 1 };
    }

    if (sql.includes(`FROM stock_movements m`) && sql.includes(`claimedQuantity`)) {
      return {
        rows: [
          {
            originalMovementId: "move-1",
            productId: "product-1",
            sku: "SKU-1",
            productName: "Sản phẩm 1",
            locationCode: "A-01",
            lotCode: null,
            serialCode: null,
            quantity: "5",
            claimedQuantity: "2",
          },
          {
            originalMovementId: "move-2",
            productId: "product-2",
            sku: "SKU-2",
            productName: "Sản phẩm 2",
            locationCode: "A-02",
            lotCode: null,
            serialCode: null,
            quantity: "3",
            claimedQuantity: "3",
          },
        ],
        rowCount: 2,
      };
    }

    throw new Error(`Unexpected query: ${sql}`);
  }
}

async function login(app: ReturnType<typeof createApp>) {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "user@example.test", password: "secure-password" }),
  });
  return (response.headers.get("set-cookie") ?? "").split(";")[0];
}

async function setupLookupApp() {
  const store = new MemoryStore();
  store.users.push({
    id: "user-1",
    email: "user@example.test",
    fullName: "User",
    kind: "warehouse_admin",
    warehouseId: "warehouse-a",
    passwordHash: await hashPassword("secure-password"),
    mustChangePassword: false,
    status: "active",
  });
  store.permissions.set("user-1", ["returns.view"]);

  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerAccessRoutes(app, store, store, secret);
  registerReturnRoutes(app, store, store, new FakeReturnPool() as never, secret);
  return { app };
}

test("lists source documents for supplier returns", async () => {
  const { app } = await setupLookupApp();
  const cookie = await login(app);
  const response = await app.request("/api/returns/source-documents?kind=supplier", {
    headers: { cookie },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: [{
      id: "doc-1",
      documentNo: "RC-001",
      partnerName: "Nhà cung cấp A",
      confirmedAt: "2026-07-17T05:00:00.000Z",
    }],
  });
});

test("lists only source lines with remaining quantity", async () => {
  const { app } = await setupLookupApp();
  const cookie = await login(app);
  const response = await app.request("/api/returns/source-documents/doc-1/lines", {
    headers: { cookie },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: [{
      originalMovementId: "move-1",
      productId: "product-1",
      sku: "SKU-1",
      productName: "Sản phẩm 1",
      locationCode: "A-01",
      lotCode: null,
      serialCode: null,
      quantity: 5,
      claimedQuantity: 2,
      remainingQuantity: 3,
    }],
  });
});
