import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import sharp from "sharp";

import { createApp } from "../src/app.js";
import { hashPassword } from "../src/domain/password.js";
import { registerAccessRoutes, type AccessStore, type AuditEntry } from "../src/modules/access.js";
import {
  type AdminDepartment,
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
import {
  permissionCatalog,
  permissionCodes,
  routePermissionCatalog,
} from "../src/modules/permissions.js";

const secret = "test-session-secret-that-is-at-least-32-characters";
const emptyMetadata = {
  roleIds: [],
  departmentId: null,
  avatarUrl: null,
  employeeCode: null,
  jobTitle: null,
  department: null,
  note: null,
};

class MemoryAdminStore implements AuthStore, AccessStore, AdminStore {
  authUsers: AuthUser[] = [];
  users: AdminUser[] = [];
  sessions = new Map<string, AuthSession>();
  permissions = new Map<string, string[]>();
  roles: AdminRole[] = [];
  departments: AdminDepartment[] = [];
  userRoles = new Map<string, string[]>();
  departmentRoles = new Map<string, string[]>();
  assignedRoleIds = new Set<string>();
  audits: AuditEntry[] = [];
  warehouseIds = ["warehouse-a"];

  private hydrateUser(user: AdminUser) {
    const departmentRoleIds = user.departmentId ? this.departmentRoles.get(user.departmentId) ?? [] : [];
    const roleIds = [...new Set([...(this.userRoles.get(user.id) ?? user.roleIds ?? []), ...departmentRoleIds])];
    const department = user.departmentId
      ? this.departments.find((item) => item.id === user.departmentId)?.name ?? user.department
      : user.department;
    return { ...user, roleIds, department };
  }

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
  async defaultWarehouseId() {
    return this.warehouseIds.length === 1 ? this.warehouseIds[0]! : null;
  }
  async listUsers(warehouseId: string | null) {
    const data = (warehouseId ? this.users.filter((user) => user.warehouseId === warehouseId) : this.users)
      .map((user) => this.hydrateUser(user));
    return { data, total: data.length };
  }
  async findUser(userId: string) {
    const user = this.users.find((candidate) => candidate.id === userId);
    return user ? this.hydrateUser(user) : null;
  }
  async createUser(input: Pick<AdminUser, "email" | "fullName" | "phone" | "kind" | "warehouseId">
    & Partial<Pick<AdminUser, "employeeCode" | "jobTitle" | "departmentId" | "note">>
    & { passwordHash: string }) {
    const { passwordHash: _passwordHash, ...profile } = input;
    const user: AdminUser = {
      ...emptyMetadata,
      ...profile,
      id: `user-${this.users.length + 1}`,
      status: "active",
    };
    this.users.push(user);
    return this.hydrateUser(user);
  }
  async updateUser(userId: string, input: Partial<AdminUser>) {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (!user) return null;
    Object.assign(user, input);
    return this.hydrateUser(user);
  }
  async setUserAvatar(userId: string, avatarUrl: string) {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (!user) return null;
    const previousAvatarUrl = user.avatarUrl;
    user.avatarUrl = avatarUrl;
    return { user: this.hydrateUser(user), previousAvatarUrl };
  }
  async findUserWarehouse(userId: string) {
    return this.users.find((user) => user.id === userId)?.warehouseId ?? null;
  }
  async findDepartmentWarehouse(departmentId: string) {
    return this.departments.find((department) => department.id === departmentId)?.warehouseId ?? null;
  }
  async setUserStatus(userId: string, status: "active" | "inactive") {
    const user = this.users.find((candidate) => candidate.id === userId);
    if (!user) return null;
    user.status = status;
    return this.hydrateUser(user);
  }
  async listRoles(warehouseId: string | null) {
    const data = warehouseId ? this.roles.filter((role) => role.warehouseId === warehouseId) : this.roles;
    return { data, total: data.length };
  }
  async findRole(warehouseId: string, roleId: string) {
    return this.roles.find((candidate) => candidate.id === roleId && candidate.warehouseId === warehouseId) ?? null;
  }
  async listDepartments(warehouseId: string | null) {
    const data = warehouseId ? this.departments.filter((department) => department.warehouseId === warehouseId) : this.departments;
    return { data, total: data.length };
  }
  async findDepartment(warehouseId: string, departmentId: string) {
    return this.departments.find((candidate) => candidate.id === departmentId && candidate.warehouseId === warehouseId) ?? null;
  }
  async createDepartment(input: Omit<AdminDepartment, "id" | "status">) {
    const department: AdminDepartment = { ...input, id: `department-${this.departments.length + 1}`, status: "active" };
    this.departments.push(department);
    this.departmentRoles.set(department.id, [...input.roleIds]);
    for (const roleId of input.roleIds) this.assignedRoleIds.add(roleId);
    return department;
  }
  async updateDepartment(warehouseId: string, departmentId: string, input: Pick<AdminDepartment, "name" | "roleIds">) {
    const department = this.departments.find((candidate) => candidate.id === departmentId && candidate.warehouseId === warehouseId);
    if (!department) return null;
    department.name = input.name;
    department.roleIds = [...input.roleIds];
    this.departmentRoles.set(departmentId, [...input.roleIds]);
    for (const roleId of input.roleIds) this.assignedRoleIds.add(roleId);
    return department;
  }
  async setDepartmentStatus(warehouseId: string, departmentId: string, status: "active" | "inactive") {
    const department = this.departments.find((candidate) => candidate.id === departmentId && candidate.warehouseId === warehouseId);
    if (!department) return null;
    department.status = status;
    return department;
  }
  async createRole(input: Omit<AdminRole, "id">) {
    const role = { ...input, id: `role-${this.roles.length + 1}` };
    this.roles.push(role);
    return role;
  }
  async updateRole(warehouseId: string, roleId: string, input: Pick<AdminRole, "name" | "permissions">) {
    const role = this.roles.find((candidate) => candidate.id === roleId && candidate.warehouseId === warehouseId);
    if (!role) return null;
    role.name = input.name;
    role.permissions = [...input.permissions];
    return role;
  }
  async deleteRole(warehouseId: string, roleId: string) {
    const index = this.roles.findIndex((candidate) => candidate.id === roleId && candidate.warehouseId === warehouseId);
    if (index < 0) return false;
    if (this.assignedRoleIds.has(roleId)) throw Object.assign(new Error("role assigned"), { code: "ROLE_ASSIGNED" });
    this.roles.splice(index, 1);
    return true;
  }
  async findRoleWarehouses(roleIds: string[]) {
    return this.roles.filter((role) => roleIds.includes(role.id)).map((role) => role.warehouseId);
  }
  async setUserRoles(userId: string, roleIds: string[]) {
    this.userRoles.set(userId, roleIds);
    for (const roleId of roleIds) this.assignedRoleIds.add(roleId);
  }
}

async function setup(options: { avatarDir?: string } = {}) {
  const store = new MemoryAdminStore();
  const passwordHash = await hashPassword("secure-password");
  store.authUsers.push(
    {
      id: "master",
      email: "master@example.test",
      fullName: "Master Admin",
      kind: "master_admin",
      warehouseId: null,
      passwordHash,
      mustChangePassword: false,
      status: "active",
    },
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
  store.permissions.set("admin-a", permissionCodes);
  store.users.push({
    id: "outside-user",
    email: "outside@example.test",
    fullName: "Outside",
    phone: "0900000002",
    ...emptyMetadata,
    kind: "warehouse_user",
    warehouseId: "warehouse-b",
    status: "active",
  });

  const app = createApp();
  registerAuthRoutes(app, store, { sessionSecret: secret, secureCookies: false });
  registerAccessRoutes(app, store, store, secret);
  registerAdminRoutes(app, store, store, store, secret, options);
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
    { code: "picker", name: "Nhân viên soạn", permissions: ["picking.view", "picking.update"] },
    { code: "checker", name: "Nhân viên kiểm", permissions: ["checking.view", "checking.approve"] },
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

  const department = await app.request("/api/admin/departments", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      code: "ban-hang",
      name: "Bán hàng",
      roleIds: store.roles.map((role) => role.id),
    }),
  });
  assert.equal(department.status, 201);
  const departmentBody = await department.json();

  const created = await app.request("/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      email: "picker@example.test",
      fullName: "Picker One",
      phone: "+84 901-234-567",
      employeeCode: "NV-001",
      jobTitle: "Nhân viên soạn",
      departmentId: departmentBody.department.id,
    }),
  });
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.user.warehouseId, "warehouse-a");
  assert.equal(body.user.phone, "+84901234567");
  assert.equal(body.user.employeeCode, "NV-001");
  assert.equal(body.user.departmentId, departmentBody.department.id);
  assert.equal(body.user.department, "Bán hàng");
  assert.deepEqual(body.user.roleIds, store.roles.map((role) => role.id));
  assert.equal(typeof body.temporaryPassword, "string");
  assert.equal("passwordHash" in body.user, false);

  assert.equal(store.audits.length, 4);
});

test("permission catalog exposes only granular feature actions", () => {
  assert.deepEqual(Object.keys(permissionCatalog), [
    "admin.users", "admin.departments", "admin.roles", "warehouse.metadata", "warehouse.operations",
    "locations", "catalog.categories", "catalog.specs", "catalog.units", "products", "partners",
    "receipts", "outbounds", "picking", "checking", "outbound.exceptions",
    "purchasing", "sales", "returns", "stockCounts", "transfers", "inventory",
    "reports", "print",
  ]);
  assert.equal(new Set(permissionCodes).size, permissionCodes.length);
  assert.equal(
    Object.values(routePermissionCatalog).every((code) => permissionCodes.includes(code)),
    true,
  );
  assert.equal(permissionCodes.some((code) => /\.manage$|^outbound\.(pick|check|ship|resolveDiscrepancy)$/.test(code)), false);
  assert.deepEqual(
    [...new Set(permissionCodes.map((code) => code.slice(code.lastIndexOf(".") + 1)))].sort(),
    ["approve", "create", "delete", "export", "print", "update", "view"],
  );
});

test("permission catalog API returns the runtime matrix", async () => {
  const { app, store } = await setup();
  store.permissions.set("admin-a", ["admin.roles.view"]);
  const cookie = await login(app, "admin@example.test");
  const response = await app.request("/api/admin/permissions", { headers: { cookie } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data[0].featureCode, "admin.users");
  assert.equal(body.data[0].actions[0].code, "admin.users.view");
  assert.equal(body.data.some((feature: { featureCode: string }) => feature.featureCode === "warehouse.metadata"), true);
  assert.equal(body.data.some((feature: { featureCode: string }) => feature.featureCode === "warehouse.operations"), true);
  assert.equal((await app.request("/api/admin/permissions", {
    headers: { cookie: await login(app, "denied@example.test") },
  })).status, 403);
});

test("granular permission migration stays synchronized with the runtime catalog", async () => {
  const [granularMigration, departmentMigration, productSpecMigration] = await Promise.all([
    readFile(new URL("../db/migrations/019_granular_permissions.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/migrations/021_departments.sql", import.meta.url), "utf8"),
    readFile(new URL("../db/migrations/022_product_specs.sql", import.meta.url), "utf8"),
  ]);
  const permissionArray = granularMigration.match(/unnest\(ARRAY\[(.*?)\]\)/s)?.[1] ?? "";
  const departmentPermissionArray = departmentMigration.match(/unnest\(ARRAY\[(.*?)\]\)/s)?.[1] ?? "";
  const productSpecPermissionArray = productSpecMigration.match(/ARRAY\[(.*?)\]/s)?.[1] ?? "";
  const migrationCodes = [
    ...permissionArray.matchAll(/'([^']+)'/g),
    ...departmentPermissionArray.matchAll(/'([^']+)'/g),
    ...productSpecPermissionArray.matchAll(/'([^']+)'/g),
  ].map((match) => match[1]!);
  assert.deepEqual(migrationCodes.sort(), [...permissionCodes].sort());
  assert.match(granularMigration, /DELETE FROM roles;/);
  assert.match(granularMigration, /WHERE users\.kind = 'warehouse_admin';/);
});

test("role validation rejects empty, unknown and duplicate permission codes", async () => {
  const { app } = await setup();
  const cookie = await login(app, "admin@example.test");

  for (const permissions of [[], ["stock.manage"], ["inventory.view", "inventory.view"]]) {
    const response = await app.request("/api/admin/roles", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ code: `invalid-${permissions.length}`, name: "Role không hợp lệ", permissions }),
    });
    assert.equal(response.status, 422);
  }
});

test("admin user requires phone and supports scoped metadata updates", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");

  const missingPhone = await app.request("/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ email: "missing@example.test", fullName: "Thiếu Phone" }),
  });
  assert.equal(missingPhone.status, 422);

  const target = store.users.find((user) => user.id === "outside-user")!;
  const forbidden = await app.request(`/api/admin/users/${target.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ phone: "0901234567" }),
  });
  assert.equal(forbidden.status, 403);

  store.users.push({
    id: "inside-user",
    email: "inside@example.test",
    fullName: "Inside",
    phone: "0900000003",
    ...emptyMetadata,
    kind: "warehouse_user",
    warehouseId: "warehouse-a",
    status: "active",
  });
  const department = await store.createDepartment({
    warehouseId: "warehouse-a",
    code: "van-hanh-kho",
    name: "Vận hành kho",
    roleIds: [],
  });
  const updated = await app.request("/api/admin/users/inside-user", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      phone: "090 123 4567",
      departmentId: department.id,
      note: "Ca sáng",
    }),
  });
  assert.equal(updated.status, 200);
  const body = await updated.json();
  assert.equal(body.user.phone, "0901234567");
  assert.equal(body.user.department, "Vận hành kho");
  assert.equal(body.user.note, "Ca sáng");
  assert.equal(store.audits.at(-1)?.action, "admin.user.update");
  assert.equal(store.audits.at(-1)?.warehouseId, "warehouse-a");
});

test("admin detail endpoints are scoped by warehouse", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const role: AdminRole = {
    id: "role-1",
    warehouseId: "warehouse-a",
    code: "picker",
    name: "Nhân viên soạn",
    permissions: ["picking.view"],
  };
  const department: AdminDepartment = {
    id: "department-1",
    warehouseId: "warehouse-a",
    code: "van-hanh-kho",
    name: "Vận hành kho",
    roleIds: [role.id],
    status: "active",
  };
  const user: AdminUser = {
    id: "user-1",
    email: "user-1@example.test",
    fullName: "Nhân viên A",
    phone: "0900000001",
    roleIds: [role.id],
    departmentId: department.id,
    avatarUrl: null,
    employeeCode: null,
    jobTitle: null,
    department: department.name,
    note: null,
    kind: "warehouse_user",
    warehouseId: "warehouse-a",
    status: "active",
  };
  store.roles.push(role, { ...role, id: "role-2", warehouseId: "warehouse-b", code: "foreign" });
  store.departments.push(department, { ...department, id: "department-2", warehouseId: "warehouse-b", code: "foreign" });
  store.users.push(user, { ...user, id: "user-2", warehouseId: "warehouse-b", email: "outside-2@example.test" });

  assert.equal((await app.request("/api/admin/users/user-1", { headers: { cookie } })).status, 200);
  assert.equal((await app.request("/api/admin/roles/role-1", { headers: { cookie } })).status, 200);
  assert.equal((await app.request("/api/admin/departments/department-1", { headers: { cookie } })).status, 200);
  assert.equal((await app.request("/api/admin/users/user-2", { headers: { cookie } })).status, 403);
  assert.equal((await app.request("/api/admin/roles/role-2", { headers: { cookie } })).status, 404);
  assert.equal((await app.request("/api/admin/departments/department-2", { headers: { cookie } })).status, 404);
});

test("master can list admin data across warehouses", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "master@example.test");
  store.users.push({
    id: "inside-user",
    email: "inside@example.test",
    fullName: "Inside",
    phone: "0900000003",
    ...emptyMetadata,
    kind: "warehouse_user",
    warehouseId: "warehouse-a",
    status: "active",
  });

  const response = await app.request("/api/admin/users", { headers: { cookie } });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data.map((user: AdminUser) => user.id), ["outside-user", "inside-user"]);
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

test("admin view permissions cannot mutate users or roles", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  store.users.push({
    id: "inside-user",
    email: "inside@example.test",
    fullName: "Inside",
    phone: "0900000003",
    ...emptyMetadata,
    kind: "warehouse_user",
    warehouseId: "warehouse-a",
    status: "active",
  });

  store.permissions.set("admin-a", ["admin.users.view", "admin.roles.view"]);
  assert.equal((await app.request("/api/admin/users", { headers: { cookie } })).status, 200);
  assert.equal((await app.request("/api/admin/roles", { headers: { cookie } })).status, 200);

  const mutations = [
    app.request("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ email: "blocked@example.test", fullName: "Blocked User", phone: "0901234567" }),
    }),
    app.request("/api/admin/users/inside-user", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ fullName: "Không được sửa" }),
    }),
    app.request("/api/admin/users/inside-user/status", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ status: "inactive" }),
    }),
    app.request("/api/admin/roles", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ code: "blocked", name: "Role bị chặn", permissions: ["inventory.view"] }),
    }),
    app.request("/api/admin/roles/role-blocked", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ name: "Không được sửa", permissions: ["inventory.view"] }),
    }),
    app.request("/api/admin/roles/role-blocked", {
      method: "DELETE",
      headers: { cookie },
    }),
  ];
  for (const response of await Promise.all(mutations)) assert.equal(response.status, 403);
  assert.equal(store.users.length, 2);
  assert.equal(store.roles.length, 0);
  assert.equal(store.audits.length, 0);
});

test("admin updates role permissions atomically and deletes an unused role", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const role = await store.createRole({ warehouseId: "warehouse-a", code: "picker", name: "Nhân viên lấy hàng", permissions: ["outbounds.view"] });

  const updated = await app.request(`/api/admin/roles/${role.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Nhân viên soạn hàng", permissions: ["outbounds.view", "picking.update"] }),
  });
  assert.equal(updated.status, 200);
  assert.deepEqual((await updated.json()).role.permissions, ["outbounds.view", "picking.update"]);
  assert.equal(role.code, "picker");

  const unused = await store.createRole({ warehouseId: "warehouse-a", code: "unused", name: "Vai trò chưa dùng", permissions: ["inventory.view"] });
  assert.equal((await app.request(`/api/admin/roles/${unused.id}`, { method: "DELETE", headers: { cookie } })).status, 204);
  assert.equal(store.roles.some((candidate) => candidate.id === unused.id), false);
  assert.deepEqual(store.audits.slice(-2).map((entry) => entry.action), ["admin.role.update", "admin.role.delete"]);
});

test("admin role mutations reject invalid, assigned and cross-warehouse changes", async () => {
  const { app, store } = await setup();
  const cookie = await login(app, "admin@example.test");
  const role = await store.createRole({ warehouseId: "warehouse-a", code: "checker", name: "Nhân viên kiểm hàng", permissions: ["outbounds.view"] });

  for (const body of [
    { name: "Rỗng", permissions: [] },
    { name: "Sai quyền", permissions: ["unknown.permission"] },
    { name: "Trùng quyền", permissions: ["outbounds.view", "outbounds.view"] },
    { code: "changed", name: "Đổi code", permissions: ["outbounds.view"] },
  ]) {
    const response = await app.request(`/api/admin/roles/${role.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 422);
  }
  assert.equal(role.name, "Nhân viên kiểm hàng");
  assert.deepEqual(role.permissions, ["outbounds.view"]);

  await store.setUserRoles("inside-user", [role.id]);
  await store.setUserRoles("inside-user", []);
  const assigned = await app.request(`/api/admin/roles/${role.id}`, { method: "DELETE", headers: { cookie } });
  assert.equal(assigned.status, 409);
  assert.match((await assigned.json()).error.message, /đã được gán/);

  const outside = await store.createRole({ warehouseId: "warehouse-b", code: "outside", name: "Kho khác", permissions: ["inventory.view"] });
  assert.equal((await app.request(`/api/admin/roles/${outside.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ name: "Không được sửa", permissions: ["inventory.view"] }),
  })).status, 404);
  assert.equal((await app.request(`/api/admin/roles/${outside.id}`, { method: "DELETE", headers: { cookie } })).status, 404);
  assert.equal(store.audits.length, 0);
});

test("avatar upload is scoped, replaces the old file and serves fixed WebP", async () => {
  const avatarDir = await mkdtemp(join(tmpdir(), "warehouse-avatar-route-"));
  try {
    const { app, store } = await setup({ avatarDir });
    const cookie = await login(app, "admin@example.test");
    store.users.push({
      id: "inside-avatar",
      email: "avatar@example.test",
      fullName: "Avatar User",
      phone: "0900000004",
      ...emptyMetadata,
      kind: "warehouse_user",
      warehouseId: "warehouse-a",
      status: "active",
    });
    const image = await sharp({
      create: { width: 320, height: 240, channels: 3, background: "#16a34a" },
    }).jpeg().toBuffer();
    const upload = () => {
      const form = new FormData();
      form.set("avatar", new File([image], "ignored.jpg", { type: "text/plain" }));
      return app.request("/api/admin/users/inside-avatar/avatar", {
        method: "POST",
        headers: { cookie },
        body: form,
      });
    };

    const first = await upload();
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.match(firstBody.user.avatarUrl, /^\/uploads\/avatars\/[0-9a-f-]+\.webp$/);
    const firstFile = join(avatarDir, basename(firstBody.user.avatarUrl));
    await access(firstFile);

    const second = await upload();
    assert.equal(second.status, 200);
    const secondBody = await second.json();
    assert.notEqual(secondBody.user.avatarUrl, firstBody.user.avatarUrl);
    await assert.rejects(access(firstFile));
    assert.equal(store.audits.at(-1)?.action, "admin.user.avatar");

    const served = await app.request(secondBody.user.avatarUrl);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("content-type"), "image/webp");

    const beforeRejected = await readdir(avatarDir);
    const outside = new FormData();
    outside.set("avatar", new File([image], "outside.jpg", { type: "image/jpeg" }));
    assert.equal((await app.request("/api/admin/users/outside-user/avatar", {
      method: "POST",
      headers: { cookie },
      body: outside,
    })).status, 403);
    assert.deepEqual(await readdir(avatarDir), beforeRejected);

    const fake = new FormData();
    fake.set("avatar", new File(["not-an-image"], "fake.png", { type: "image/png" }));
    assert.equal((await app.request("/api/admin/users/inside-avatar/avatar", {
      method: "POST",
      headers: { cookie },
      body: fake,
    })).status, 422);
    assert.deepEqual(await readdir(avatarDir), beforeRejected);

    const oversized = new FormData();
    oversized.set("avatar", new File([Buffer.alloc(5 * 1024 * 1024 + 1)], "large.png"));
    assert.equal((await app.request("/api/admin/users/inside-avatar/avatar", {
      method: "POST",
      headers: { cookie },
      body: oversized,
    })).status, 413);
    assert.deepEqual(await readdir(avatarDir), beforeRejected);
  } finally {
    await rm(avatarDir, { recursive: true, force: true });
  }
});
