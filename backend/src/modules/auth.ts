import { createHmac, randomBytes } from "node:crypto";
import type { Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Pool } from "pg";
import { z } from "zod";

import { hashPassword, verifyPassword } from "../domain/password.js";
import { HttpError } from "../http/errors.js";
import { parseJson } from "../http/validation.js";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  kind: "master_admin" | "warehouse_admin" | "warehouse_user";
  warehouseId: string | null;
  passwordHash: string;
  mustChangePassword: boolean;
  status: "active" | "inactive";
}

export interface AuthSession {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthStore {
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  createSession(session: AuthSession): Promise<void>;
  findSession(tokenHash: string): Promise<AuthSession | null>;
  deleteSession(tokenHash: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}

type AuthOptions = { sessionSecret: string; secureCookies: boolean };

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});
const passwordSchema = z.object({ password: z.string().min(12).max(128) });
const dummyHash = `scrypt$${"00".repeat(16)}$${"00".repeat(64)}`;

const publicUser = ({ passwordHash: _passwordHash, ...user }: AuthUser) => user;
const tokenHash = (token: string, secret: string) =>
  createHmac("sha256", secret).update(token).digest("hex");

export async function resolveSession(
  context: Context,
  store: AuthStore,
  sessionSecret: string,
) {
  const token = getCookie(context, "session");
  if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Chưa đăng nhập");

  const hash = tokenHash(token, sessionSecret);
  const session = await store.findSession(hash);
  if (!session || session.expiresAt.getTime() <= Date.now()) {
    if (session) await store.deleteSession(hash);
    throw new HttpError(401, "UNAUTHENTICATED", "Phiên đăng nhập không hợp lệ");
  }
  const user = await store.findUserById(session.userId);
  if (!user || user.status !== "active") {
    await store.deleteSession(hash);
    throw new HttpError(401, "UNAUTHENTICATED", "Phiên đăng nhập không hợp lệ");
  }
  return { user, tokenHash: hash };
}

export function registerAuthRoutes(
  app: Hono,
  store: AuthStore,
  options: AuthOptions,
) {
  // ponytail: per-process limiter; replace with shared storage when deploying replicas.
  const failures = new Map<string, { count: number; resetAt: number }>();

  app.post("/api/auth/login", async (c) => {
    const input = await parseJson(c, loginSchema);
    const key = `${c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local"}:${input.email}`;
    const now = Date.now();
    const attempts = failures.get(key);
    if (attempts && attempts.resetAt > now && attempts.count >= 10) {
      c.header("retry-after", String(Math.ceil((attempts.resetAt - now) / 1000)));
      throw new HttpError(429, "RATE_LIMITED", "Thử đăng nhập lại sau");
    }
    if (attempts && attempts.resetAt <= now) failures.delete(key);

    const user = await store.findUserByEmail(input.email);
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? dummyHash,
    );
    if (!user || user.status !== "active" || !valid) {
      const current = failures.get(key);
      failures.set(key, {
        count: (current?.count ?? 0) + 1,
        resetAt: current?.resetAt ?? now + 15 * 60 * 1000,
      });
      throw new HttpError(
        401,
        "INVALID_CREDENTIALS",
        "Email hoặc mật khẩu không đúng",
      );
    }
    failures.delete(key);

    const token = randomBytes(32).toString("base64url");
    await store.createSession({
      userId: user.id,
      tokenHash: tokenHash(token, options.sessionSecret),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    setCookie(c, "session", token, {
      httpOnly: true,
      sameSite: "Lax",
      secure: options.secureCookies,
      path: "/",
      maxAge: 24 * 60 * 60,
    });
    return c.json({ user: publicUser(user) });
  });

  app.get("/api/auth/session", async (c) => {
    const { user } = await resolveSession(c, store, options.sessionSecret);
    return c.json({ user: publicUser(user) });
  });

  app.post("/api/auth/change-password", async (c) => {
    const { user } = await resolveSession(c, store, options.sessionSecret);
    const { password } = await parseJson(c, passwordSchema);
    await store.updatePassword(user.id, await hashPassword(password));
    return c.body(null, 204);
  });

  app.post("/api/auth/logout", async (c) => {
    const { tokenHash: hash } = await resolveSession(
      c,
      store,
      options.sessionSecret,
    );
    await store.deleteSession(hash);
    deleteCookie(c, "session", { path: "/", secure: options.secureCookies });
    return c.body(null, 204);
  });
}

export function createPostgresAuthStore(pool: Pool): AuthStore {
  const userQuery = `
    SELECT id, email, full_name AS "fullName", kind,
      warehouse_id AS "warehouseId", password_hash AS "passwordHash",
      must_change_password AS "mustChangePassword", status
    FROM users`;
  return {
    async findUserByEmail(email) {
      const result = await pool.query<AuthUser>(`${userQuery} WHERE email = $1`, [email]);
      return result.rows[0] ?? null;
    },
    async findUserById(id) {
      const result = await pool.query<AuthUser>(`${userQuery} WHERE id = $1`, [id]);
      return result.rows[0] ?? null;
    },
    async createSession(session) {
      await pool.query(
        `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [session.userId, session.tokenHash, session.expiresAt],
      );
    },
    async findSession(hash) {
      const result = await pool.query<AuthSession>(
        `SELECT user_id AS "userId", token_hash AS "tokenHash", expires_at AS "expiresAt"
         FROM sessions WHERE token_hash = $1`,
        [hash],
      );
      return result.rows[0] ?? null;
    },
    async deleteSession(hash) {
      await pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [hash]);
    },
    async updatePassword(userId, passwordHash) {
      await pool.query(
        `UPDATE users SET password_hash = $1, must_change_password = false,
         updated_at = now() WHERE id = $2`,
        [passwordHash, userId],
      );
    },
  };
}
