import { randomBytes } from "node:crypto";
import type { Context, Hono } from "hono";
import type { Pool } from "pg";
import { z } from "zod";

import { hashPassword } from "../domain/password.js";
import { HttpError } from "../http/errors.js";
import { parseJson, parsePagination } from "../http/validation.js";
import {
  auditChange,
  requireAccess,
  type AccessActor,
  type AccessStore,
} from "./access.js";
import type { AuthStore } from "./auth.js";

export const permissionCodes = [
  "admin.access.manage",
  "locations.manage",
  "catalog.manage",
  "products.manage",
  "partners.manage",
  "stock.receive",
  "stock.view",
  "outbound.create",
  "outbound.release",
  "outbound.pick",
  "outbound.check",
  "outbound.ship",
  "outbound.resolveDiscrepancy",
  "reports.view",
  "reports.export",
] as const;

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  avatarUrl: string | null;
  employeeCode: string | null;
  jobTitle: string | null;
  department: string | null;
  note: string | null;
  kind: "warehouse_admin" | "warehouse_user";
  warehouseId: string;
  status: "active" | "inactive";
}

export interface AdminRole {
  id: string;
  warehouseId: string;
  code: string;
  name: string;
  permissions: string[];
}

type Page<T> = { data: T[]; total: number };
type AdminUserWrite = Pick<AdminUser, "email" | "fullName" | "phone">
  & Partial<Pick<AdminUser, "employeeCode" | "jobTitle" | "department" | "note">>;

export interface AdminStore {
  defaultWarehouseId(): Promise<string | null>;
  listUsers(warehouseId: string | null, limit: number, offset: number): Promise<Page<AdminUser>>;
  createUser(
    input: AdminUserWrite & Pick<AdminUser, "kind" | "warehouseId"> & { passwordHash: string },
  ): Promise<AdminUser>;
  updateUser(userId: string, input: Partial<AdminUserWrite>): Promise<AdminUser | null>;
  findUserWarehouse(userId: string): Promise<string | null>;
  setUserStatus(userId: string, status: "active" | "inactive"): Promise<AdminUser | null>;
  listRoles(warehouseId: string | null, limit: number, offset: number): Promise<Page<AdminRole>>;
  createRole(input: Omit<AdminRole, "id">): Promise<AdminRole>;
  findRoleWarehouses(roleIds: string[]): Promise<string[]>;
  setUserRoles(userId: string, roleIds: string[]): Promise<void>;
}

const phoneSchema = z.string().trim()
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+?[0-9]{8,15}$/, "Số điện thoại không hợp lệ"));
const userFields = {
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  fullName: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  employeeCode: z.string().trim().min(1).max(50).nullable().optional(),
  jobTitle: z.string().trim().min(1).max(100).nullable().optional(),
  department: z.string().trim().min(1).max(100).nullable().optional(),
  note: z.string().trim().min(1).max(500).nullable().optional(),
};
const userSchema = z.object(userFields).strict();
const userUpdateSchema = z.object(userFields).partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  "Phải có ít nhất một trường cần cập nhật",
);
const statusSchema = z.object({ status: z.enum(["active", "inactive"]) });
const roleSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[a-z][a-z0-9_-]*$/),
  name: z.string().trim().min(2).max(100),
  permissions: z.array(z.enum(permissionCodes)).min(1).max(permissionCodes.length),
});
const assignmentSchema = z.object({ roleIds: z.array(z.string().min(1)).max(20) });

async function warehouseFor(context: Context, actor: AccessActor, store: AdminStore) {
  if (actor.user.kind !== "master_admin") {
    if (!actor.user.warehouseId) throw new HttpError(403, "FORBIDDEN", "Không có kho");
    return actor.user.warehouseId;
  }
  const requested = context.req.query("warehouseId");
  if (!requested) {
    const defaultWarehouseId = await store.defaultWarehouseId();
    if (defaultWarehouseId) return defaultWarehouseId;
  }
  const result = z.string().uuid().safeParse(requested);
  if (!result.success) {
    throw new HttpError(422, "VALIDATION_ERROR", "Master phải chọn warehouseId hợp lệ");
  }
  return result.data;
}

function warehouseScopeFor(context: Context, actor: AccessActor) {
  if (actor.user.kind !== "master_admin") {
    if (!actor.user.warehouseId) throw new HttpError(403, "FORBIDDEN", "Không có kho");
    return actor.user.warehouseId;
  }
  const requested = context.req.query("warehouseId");
  if (!requested) return null;
  const result = z.string().uuid().safeParse(requested);
  if (!result.success) {
    throw new HttpError(422, "VALIDATION_ERROR", "warehouseId không hợp lệ");
  }
  return result.data;
}

function assertWarehouse(actor: AccessActor, warehouseId: string | null) {
  if (!warehouseId) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy dữ liệu");
  if (actor.user.kind !== "master_admin" && actor.user.warehouseId !== warehouseId) {
    throw new HttpError(403, "FORBIDDEN", "Không có quyền truy cập kho này");
  }
}

const conflict = (error: unknown) => {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    throw new HttpError(409, "DUPLICATE", "Mã hoặc email đã tồn tại");
  }
  throw error;
};

export function registerAdminRoutes(
  app: Hono,
  authStore: AuthStore,
  accessStore: AccessStore,
  adminStore: AdminStore,
  sessionSecret: string,
) {
  const actor = (context: Context) =>
    requireAccess(context, authStore, accessStore, sessionSecret, {
      permission: "admin.access.manage",
    });

  app.get("/api/admin/users", async (c) => {
    const current = await actor(c);
    const warehouseId = warehouseScopeFor(c, current);
    const pagination = parsePagination(c.req.query());
    const result = await adminStore.listUsers(
      warehouseId,
      pagination.pageSize,
      pagination.offset,
    );
    return c.json({
      data: result.data,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / pagination.pageSize),
      },
    });
  });

  app.post("/api/admin/users", async (c) => {
    const current = await actor(c);
    const warehouseId = await warehouseFor(c, current, adminStore);
    const input = await parseJson(c, userSchema);
    const temporaryPassword = randomBytes(12).toString("base64url");
    let user: AdminUser;
    try {
      user = await adminStore.createUser({
        ...input,
        kind: "warehouse_user",
        warehouseId,
        passwordHash: await hashPassword(temporaryPassword),
      });
    } catch (error) {
      conflict(error);
    }
    await auditChange(accessStore, current, {
      warehouseId,
      action: "admin.user.create",
      entityType: "user",
      entityId: user!.id,
    });
    const { passwordHash: _passwordHash, ...safeUser } = user! as AdminUser & {
      passwordHash?: string;
    };
    return c.json({ user: safeUser, temporaryPassword }, 201);
  });

  app.patch("/api/admin/users/:id/status", async (c) => {
    const current = await actor(c);
    const targetId = c.req.param("id");
    const { status } = await parseJson(c, statusSchema);
    if (targetId === current.user.id && status === "inactive") {
      throw new HttpError(422, "SELF_DISABLE", "Không thể tự vô hiệu hóa tài khoản");
    }
    const warehouseId = await adminStore.findUserWarehouse(targetId);
    assertWarehouse(current, warehouseId);
    const user = await adminStore.setUserStatus(targetId, status);
    if (!user) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy người dùng");
    await auditChange(accessStore, current, {
      warehouseId,
      action: "admin.user.status",
      entityType: "user",
      entityId: targetId,
      metadata: { status },
    });
    return c.json({ user });
  });

  app.patch("/api/admin/users/:id", async (c) => {
    const current = await actor(c);
    const targetId = c.req.param("id");
    const warehouseId = await adminStore.findUserWarehouse(targetId);
    assertWarehouse(current, warehouseId);
    const input = await parseJson(c, userUpdateSchema);
    let user: AdminUser | null = null;
    try {
      user = await adminStore.updateUser(targetId, input);
    } catch (error) {
      conflict(error);
    }
    if (!user) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy người dùng");
    await auditChange(accessStore, current, {
      warehouseId,
      action: "admin.user.update",
      entityType: "user",
      entityId: targetId,
      metadata: { fields: Object.keys(input) },
    });
    return c.json({ user });
  });

  app.get("/api/admin/roles", async (c) => {
    const current = await actor(c);
    const warehouseId = warehouseScopeFor(c, current);
    const pagination = parsePagination(c.req.query());
    const result = await adminStore.listRoles(
      warehouseId,
      pagination.pageSize,
      pagination.offset,
    );
    return c.json({
      data: result.data,
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems: result.total,
        totalPages: Math.ceil(result.total / pagination.pageSize),
      },
    });
  });

  app.post("/api/admin/roles", async (c) => {
    const current = await actor(c);
    const warehouseId = await warehouseFor(c, current, adminStore);
    const input = await parseJson(c, roleSchema);
    let role: AdminRole;
    try {
      role = await adminStore.createRole({ ...input, warehouseId });
    } catch (error) {
      conflict(error);
    }
    await auditChange(accessStore, current, {
      warehouseId,
      action: "admin.role.create",
      entityType: "role",
      entityId: role!.id,
    });
    return c.json({ role: role! }, 201);
  });

  app.put("/api/admin/users/:id/roles", async (c) => {
    const current = await actor(c);
    const targetId = c.req.param("id");
    const { roleIds } = await parseJson(c, assignmentSchema);
    const warehouseId = await adminStore.findUserWarehouse(targetId);
    assertWarehouse(current, warehouseId);
    const roleWarehouses = await adminStore.findRoleWarehouses(roleIds);
    if (roleWarehouses.length !== roleIds.length || roleWarehouses.some((id) => id !== warehouseId)) {
      throw new HttpError(422, "INVALID_ROLE_SCOPE", "Role không thuộc cùng kho");
    }
    await adminStore.setUserRoles(targetId, roleIds);
    await auditChange(accessStore, current, {
      warehouseId,
      action: "admin.user.roles",
      entityType: "user",
      entityId: targetId,
      metadata: { roleIds },
    });
    return c.body(null, 204);
  });
}

export function createPostgresAdminStore(pool: Pool): AdminStore {
  const userColumns = `id, email, full_name AS "fullName", phone,
    avatar_url AS "avatarUrl", employee_code AS "employeeCode",
    job_title AS "jobTitle", department, note, kind,
    warehouse_id AS "warehouseId", status`;
  return {
    async defaultWarehouseId() {
      const result = await pool.query<{ id: string }>(
        `SELECT id FROM warehouses ORDER BY code LIMIT 2`,
      );
      return result.rows.length === 1 ? result.rows[0]!.id : null;
    },
    async listUsers(warehouseId, limit, offset) {
      const [rows, count] = await Promise.all([
        pool.query<AdminUser>(
          `SELECT ${userColumns} FROM users
           WHERE warehouse_id IS NOT NULL AND ($1::uuid IS NULL OR warehouse_id = $1)
           ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
          [warehouseId, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(*) FROM users WHERE warehouse_id IS NOT NULL AND ($1::uuid IS NULL OR warehouse_id = $1)`,
          [warehouseId],
        ),
      ]);
      return { data: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
    },
    async createUser(input) {
      const result = await pool.query<AdminUser>(
        `INSERT INTO users
          (email, password_hash, full_name, phone, employee_code, job_title,
           department, note, kind, warehouse_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${userColumns}`,
        [
          input.email,
          input.passwordHash,
          input.fullName,
          input.phone,
          input.employeeCode ?? null,
          input.jobTitle ?? null,
          input.department ?? null,
          input.note ?? null,
          input.kind,
          input.warehouseId,
        ],
      );
      const user = result.rows[0];
      if (!user) throw new Error("User insert returned no row");
      return user;
    },
    async updateUser(userId, input) {
      const columns: Record<keyof AdminUserWrite, string> = {
        email: "email",
        fullName: "full_name",
        phone: "phone",
        employeeCode: "employee_code",
        jobTitle: "job_title",
        department: "department",
        note: "note",
      };
      const entries = Object.entries(input).filter((entry) => entry[1] !== undefined);
      const updates = entries.map(([key], index) => `${columns[key as keyof AdminUserWrite]} = $${index + 2}`);
      const result = await pool.query<AdminUser>(
        `UPDATE users SET ${updates.join(", ")}, updated_at = now() WHERE id = $1
         RETURNING ${userColumns}`,
        [userId, ...entries.map((entry) => entry[1])],
      );
      return result.rows[0] ?? null;
    },
    async findUserWarehouse(userId) {
      const result = await pool.query<{ warehouseId: string }>(
        `SELECT warehouse_id AS "warehouseId" FROM users WHERE id = $1`,
        [userId],
      );
      return result.rows[0]?.warehouseId ?? null;
    },
    async setUserStatus(userId, status) {
      const result = await pool.query<AdminUser>(
        `UPDATE users SET status = $1, updated_at = now() WHERE id = $2
         RETURNING ${userColumns}`,
        [status, userId],
      );
      return result.rows[0] ?? null;
    },
    async listRoles(warehouseId, limit, offset) {
      const [rows, count] = await Promise.all([
        pool.query<AdminRole>(
          `SELECT r.id, r.warehouse_id AS "warehouseId", r.code, r.name,
             COALESCE(array_agg(rpc.permission_code) FILTER (WHERE rpc.permission_code IS NOT NULL), '{}') AS permissions
           FROM roles r LEFT JOIN role_permission_codes rpc ON rpc.role_id = r.id
           WHERE ($1::uuid IS NULL OR r.warehouse_id = $1) GROUP BY r.id
           ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
          [warehouseId, limit, offset],
        ),
        pool.query<{ count: string }>(
          `SELECT count(*) FROM roles WHERE ($1::uuid IS NULL OR warehouse_id = $1)`,
          [warehouseId],
        ),
      ]);
      return { data: rows.rows, total: Number(count.rows[0]?.count ?? 0) };
    },
    async createRole(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<Omit<AdminRole, "permissions">>(
          `INSERT INTO roles (warehouse_id, code, name) VALUES ($1, $2, $3)
           RETURNING id, warehouse_id AS "warehouseId", code, name`,
          [input.warehouseId, input.code, input.name],
        );
        const role = result.rows[0];
        if (!role) throw new Error("Role insert returned no row");
        await client.query(
          `INSERT INTO role_permission_codes (role_id, permission_code)
           SELECT $1, unnest($2::text[])`,
          [role.id, input.permissions],
        );
        await client.query("COMMIT");
        return { ...role, permissions: input.permissions };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async findRoleWarehouses(roleIds) {
      if (roleIds.length === 0) return [];
      const result = await pool.query<{ warehouseId: string }>(
        `SELECT warehouse_id AS "warehouseId" FROM roles WHERE id = ANY($1::uuid[])`,
        [roleIds],
      );
      return result.rows.map((row) => row.warehouseId);
    },
    async setUserRoles(userId, roleIds) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
        if (roleIds.length > 0) {
          await client.query(
            `INSERT INTO user_roles (user_id, role_id)
             SELECT $1, unnest($2::uuid[])`,
            [userId, roleIds],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
