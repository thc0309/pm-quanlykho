import type { Context, Hono } from "hono";
import type { Pool } from "pg";

import { HttpError } from "../http/errors.js";
import { resolveSession, type AuthStore, type AuthUser } from "./auth.js";
import { hasPermission, type PermissionCode } from "./permissions.js";

export interface AuditEntry {
  warehouseId: string | null;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
}

export interface AccessStore {
  listPermissions(userId: string): Promise<string[]>;
  insertAudit(entry: AuditEntry): Promise<void>;
}

export interface AccessActor {
  user: AuthUser;
  permissions: string[];
}

export async function requireAccess(
  context: Context,
  authStore: AuthStore,
  accessStore: AccessStore,
  sessionSecret: string,
  required: { permission?: PermissionCode; warehouseId?: string } = {},
): Promise<AccessActor> {
  const { user } = await resolveSession(context, authStore, sessionSecret);
  if (user.mustChangePassword) {
    throw new HttpError(
      403,
      "PASSWORD_CHANGE_REQUIRED",
      "Phải đổi mật khẩu tạm trước khi tiếp tục",
    );
  }
  if (
    required.warehouseId &&
    user.kind !== "master_admin" &&
    user.warehouseId !== required.warehouseId
  ) {
    throw new HttpError(403, "FORBIDDEN", "Không có quyền truy cập kho này");
  }

  const permissions =
    user.kind === "master_admin" ? ["*"] : await accessStore.listPermissions(user.id);
  if (
    required.permission &&
    !hasPermission(permissions, required.permission)
  ) {
    throw new HttpError(403, "FORBIDDEN", "Không có quyền thực hiện thao tác");
  }
  return { user, permissions };
}

export async function auditChange(
  store: AccessStore,
  actor: AccessActor,
  change: {
    warehouseId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await store.insertAudit({
    warehouseId: change.warehouseId ?? actor.user.warehouseId,
    actorUserId: actor.user.id,
    action: change.action,
    entityType: change.entityType,
    entityId: change.entityId ?? null,
    reason: change.reason ?? null,
    metadata: change.metadata ?? {},
  });
}

export function registerAccessRoutes(
  app: Hono,
  authStore: AuthStore,
  accessStore: AccessStore,
  sessionSecret: string,
) {
  app.get("/api/access/me", async (c) => {
    const actor = await requireAccess(c, authStore, accessStore, sessionSecret);
    return c.json({
      access: {
        userId: actor.user.id,
        warehouseId: actor.user.warehouseId,
        kind: actor.user.kind,
        permissions: actor.permissions,
      },
    });
  });
}

export function createPostgresAccessStore(pool: Pool): AccessStore {
  return {
    async listPermissions(userId) {
      const result = await pool.query<{ permissionCode: string }>(
        `SELECT DISTINCT rpc.permission_code AS "permissionCode"
         FROM (
           SELECT ur.role_id
           FROM user_roles ur
           WHERE ur.user_id = $1
           UNION
           SELECT dr.role_id
           FROM users u
           JOIN department_roles dr ON dr.department_id = u.department_id
           WHERE u.id = $1
         ) granted
         JOIN role_permission_codes rpc ON rpc.role_id = granted.role_id`,
        [userId],
      );
      return result.rows.map((row) => row.permissionCode);
    },
    async insertAudit(entry) {
      await pool.query(
        `INSERT INTO audit_logs
          (warehouse_id, actor_user_id, action, entity_type, entity_id, reason, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.warehouseId,
          entry.actorUserId,
          entry.action,
          entry.entityType,
          entry.entityId,
          entry.reason,
          entry.metadata,
        ],
      );
    },
  };
}
