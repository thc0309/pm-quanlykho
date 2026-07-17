import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import type { AccessStore, AuditEntry } from "../src/modules/access.js";
import { registerAuthRoutes, type AuthSession, type AuthStore, type AuthUser } from "../src/modules/auth.js";
import {
  registerCatalogSpecRoutes,
  type CatalogSpecStore,
  type CategorySpecDefinition,
  type CategorySpecOption,
} from "../src/modules/catalog-specs.js";

const secret = "test-session-secret-that-is-at-least-32-characters";

class MemoryCatalogSpecStore implements AuthStore, AccessStore, CatalogSpecStore {
  users: AuthUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  audits: AuditEntry[] = [];
  warehouseIds = ["warehouse-a"];
  categoryWarehouse = new Map<string, string>();
  definitions: CategorySpecDefinition[] = [];

  async findUserByEmail(email: string) { return this.users.find((user) => user.email === email) ?? null; }
  async findUserById(id: string) { return this.users.find((user) => user.id === id) ?? null; }
  async createSession(session: AuthSession) { this.sessions.set(session.tokenHash, session); }
  async findSession(hash: string) { return this.sessions.get(hash) ?? null; }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async updatePassword() {}
  async listPermissions(userId: string) { return this.permissions.get(userId) ?? []; }
  async insertAudit(entry: AuditEntry) { this.audits.push(entry); }
  async defaultWarehouseId() { return this.warehouseIds.length === 1 ? this.warehouseIds[0]! : null; }

  async listDefinitions(warehouseId: string, categoryId: string) {
    if (this.categoryWarehouse.get(categoryId) !== warehouseId) return null;
    return this.definitions
      .filter((definition) => definition.warehouseId === warehouseId && definition.categoryId === categoryId)
      .map((definition) => ({ ...definition, options: definition.options.map((option) => ({ ...option })) }));
  }

  async createDefinition(input: Omit<CategorySpecDefinition, "id" | "status"> & {
    options: Array<Pick<CategorySpecOption, "value" | "label" | "sortOrder">>;
  }) {
    if (this.categoryWarehouse.get(input.categoryId) !== input.warehouseId) return null;
    if (this.definitions.some((definition) => definition.categoryId === input.categoryId && definition.code === input.code)) {
      throw Object.assign(new Error("duplicate definition"), { code: "23505" });
    }
    const definitionId = randomUUID();
    const definition: CategorySpecDefinition = {
      ...input,
      id: definitionId,
      status: "active",
      options: input.options.map((option) => ({
        id: randomUUID(),
        definitionId,
        value: option.value,
        label: option.label,
        sortOrder: option.sortOrder,
        status: "active",
      })),
    };
    this.definitions.push(definition);
    return { ...definition, options: definition.options.map((option) => ({ ...option })) };
  }

  async updateDefinition(
    warehouseId: string,
    definitionId: string,
    input: Pick<CategorySpecDefinition, "name" | "required" | "unit" | "minValue" | "maxValue" | "sortOrder">,
  ) {
    const definition = this.definitions.find((item) => item.id === definitionId && item.warehouseId === warehouseId);
    if (!definition) return null;
    if (definition.type !== "number" && (input.unit !== null || input.minValue !== null || input.maxValue !== null)) {
      throw Object.assign(new Error("invalid definition type"), { code: "INVALID_DEFINITION_TYPE" });
    }
    Object.assign(definition, input);
    return { ...definition, options: definition.options.map((option) => ({ ...option })) };
  }

  async setDefinitionStatus(warehouseId: string, definitionId: string, status: CategorySpecDefinition["status"]) {
    const definition = this.definitions.find((item) => item.id === definitionId && item.warehouseId === warehouseId);
    if (!definition) return null;
    definition.status = status;
    return { ...definition, options: definition.options.map((option) => ({ ...option })) };
  }

  async createOption(
    warehouseId: string,
    definitionId: string,
    input: Pick<CategorySpecOption, "value" | "label" | "sortOrder">,
  ) {
    const definition = this.definitions.find((item) => item.id === definitionId && item.warehouseId === warehouseId);
    if (!definition) return null;
    if (definition.type !== "select") throw Object.assign(new Error("invalid definition type"), { code: "INVALID_DEFINITION_TYPE" });
    if (definition.options.some((option) => option.value === input.value)) {
      throw Object.assign(new Error("duplicate option"), { code: "23505" });
    }
    const option: CategorySpecOption = { ...input, id: randomUUID(), definitionId, status: "active" };
    definition.options.push(option);
    return { ...option };
  }

  async updateOption(
    warehouseId: string,
    optionId: string,
    input: Pick<CategorySpecOption, "label" | "sortOrder">,
  ) {
    for (const definition of this.definitions) {
      if (definition.warehouseId !== warehouseId) continue;
      const option = definition.options.find((item) => item.id === optionId);
      if (!option) continue;
      option.label = input.label;
      option.sortOrder = input.sortOrder;
      return { ...option };
    }
    return null;
  }

  async setOptionStatus(warehouseId: string, optionId: string, status: CategorySpecOption["status"]) {
    for (const definition of this.definitions) {
      if (definition.warehouseId !== warehouseId) continue;
      const option = definition.options.find((item) => item.id === optionId);
      if (!option) continue;
      option.status = status;
      return { ...option };
    }
    return null;
  }
}

async function setup() {
  const store = new MemoryCatalogSpecStore();
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
  store.permissions.set("admin-a", ["catalog.specs.view", "catalog.specs.create", "catalog.specs.update", "catalog.specs.delete"]);
  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerCatalogSpecRoutes(app, store, store, store, secret);
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

test("admin creates and lists category spec definitions", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const categoryId = randomUUID();
  store.categoryWarehouse.set(categoryId, "warehouse-a");

  const numberSpec = await app.request(`/api/catalog/categories/${categoryId}/spec-definitions`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      code: "ram",
      name: "RAM",
      type: "number",
      required: true,
      unit: "GB",
      minValue: 1,
      maxValue: 64,
      sortOrder: 1,
    }),
  });
  assert.equal(numberSpec.status, 201);

  const selectSpec = await app.request(`/api/catalog/categories/${categoryId}/spec-definitions`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      code: "color",
      name: "Màu",
      type: "select",
      required: false,
      sortOrder: 2,
      options: [
        { value: "black", label: "Đen", sortOrder: 1 },
        { value: "silver", label: "Bạc", sortOrder: 2 },
      ],
    }),
  });
  assert.equal(selectSpec.status, 201);

  const list = await app.request(`/api/catalog/categories/${categoryId}/spec-definitions`, { headers: { cookie } });
  assert.equal(list.status, 200);
  const body = await list.json();
  assert.equal(body.data.length, 2);
  assert.equal(body.data[1].options.length, 2);
  assert.equal(store.audits.length, 2);
});

test("catalog spec routes enforce validation and permissions", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const deniedCookie = await login(app, "denied@example.test");
  const categoryId = randomUUID();
  store.categoryWarehouse.set(categoryId, "warehouse-a");

  const invalid = await app.request(`/api/catalog/categories/${categoryId}/spec-definitions`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      code: "length",
      name: "Độ dài",
      type: "text",
      unit: "cm",
    }),
  });
  assert.equal(invalid.status, 422);

  store.permissions.set("denied-a", ["catalog.specs.view"]);
  assert.equal((await app.request(`/api/catalog/categories/${categoryId}/spec-definitions`, { headers: { cookie: deniedCookie } })).status, 200);
  assert.equal((await app.request(`/api/catalog/categories/${categoryId}/spec-definitions`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: deniedCookie },
    body: JSON.stringify({ code: "cpu", name: "CPU", type: "text", required: true }),
  })).status, 403);
});

test("catalog spec update, option mutation and status are scoped and audited", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const categoryId = randomUUID();
  const definitionId = randomUUID();
  const optionId = randomUUID();
  store.categoryWarehouse.set(categoryId, "warehouse-a");
  store.definitions.push({
    id: definitionId,
    warehouseId: "warehouse-a",
    categoryId,
    code: "color",
    name: "Màu",
    type: "select",
    required: false,
    unit: null,
    minValue: null,
    maxValue: null,
    sortOrder: 1,
    status: "active",
    options: [
      { id: optionId, definitionId, value: "black", label: "Đen", sortOrder: 1, status: "active" },
    ],
  });

  const updated = await app.request(`/api/catalog/spec-definitions/${definitionId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Màu sắc", required: true, unit: null, minValue: null, maxValue: null, sortOrder: 3 }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).definition.name, "Màu sắc");

  const createdOption = await app.request(`/api/catalog/spec-definitions/${definitionId}/options`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ value: "silver", label: "Bạc", sortOrder: 2 }),
  });
  assert.equal(createdOption.status, 201);
  const createdOptionBody = await createdOption.json();

  const updatedOption = await app.request(`/api/catalog/spec-options/${createdOptionBody.option.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ label: "Bạc nhám", sortOrder: 4 }),
  });
  assert.equal(updatedOption.status, 200);

  const optionStatus = await app.request(`/api/catalog/spec-options/${createdOptionBody.option.id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ status: "inactive" }),
  });
  assert.equal(optionStatus.status, 200);

  const definitionStatus = await app.request(`/api/catalog/spec-definitions/${definitionId}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ status: "inactive" }),
  });
  assert.equal(definitionStatus.status, 200);
  assert.deepEqual(
    store.audits.slice(-5).map((entry) => entry.action),
    [
      "catalog.spec.definition.update",
      "catalog.spec.option.create",
      "catalog.spec.option.update",
      "catalog.spec.option.status",
      "catalog.spec.definition.status",
    ],
  );
});
