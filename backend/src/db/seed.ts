import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { hashPassword } from "../domain/password.js";
import { pool, closePool } from "./pool.js";

const seedsDir = join(process.cwd(), "db", "seeds");

async function seed() {
  const seedEnv = z
    .object({
      MASTER_EMAIL: z.string().email(),
      MASTER_PASSWORD: z.string().min(12).max(128),
      WAREHOUSE_ADMIN_EMAIL: z.string().email().optional(),
      WAREHOUSE_ADMIN_PASSWORD: z.string().min(12).max(128).optional(),
    })
    .refine(
      (value) => Boolean(value.WAREHOUSE_ADMIN_EMAIL) === Boolean(value.WAREHOUSE_ADMIN_PASSWORD),
      "Warehouse admin email and password must be provided together",
    )
    .parse(process.env);
  const files = (await readdir(seedsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await readFile(join(seedsDir, file), "utf8");
    await pool.query(sql);
    console.log(`seeded ${file}`);
  }

  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, kind, warehouse_id)
     VALUES ($1, $2, 'Master Admin', 'master_admin', NULL)
     ON CONFLICT (email) DO NOTHING`,
    [seedEnv.MASTER_EMAIL.toLowerCase(), await hashPassword(seedEnv.MASTER_PASSWORD)],
  );
  console.log("seeded master admin");

  if (seedEnv.WAREHOUSE_ADMIN_EMAIL && seedEnv.WAREHOUSE_ADMIN_PASSWORD) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const warehouse = await client.query<{ id: string }>(
        `SELECT id FROM warehouses WHERE code = 'MAIN'`,
      );
      const warehouseId = warehouse.rows[0]?.id;
      if (!warehouseId) throw new Error("MAIN warehouse is missing");
      const role = await client.query<{ id: string }>(
        `INSERT INTO roles (warehouse_id, code, name)
         VALUES ($1, 'warehouse_admin', 'Quản trị kho')
         ON CONFLICT (warehouse_id, code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [warehouseId],
      );
      const roleId = role.rows[0]?.id;
      if (!roleId) throw new Error("Warehouse admin role is missing");
      await client.query(
        `INSERT INTO role_permission_codes (role_id, permission_code)
         SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`,
        [roleId, ["admin.access.manage", "locations.manage", "catalog.manage", "products.manage"]],
      );
      const admin = await client.query<{ id: string }>(
        `INSERT INTO users
          (email, password_hash, full_name, kind, warehouse_id)
         VALUES ($1, $2, 'Warehouse Admin', 'warehouse_admin', $3)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [
          seedEnv.WAREHOUSE_ADMIN_EMAIL.toLowerCase(),
          await hashPassword(seedEnv.WAREHOUSE_ADMIN_PASSWORD),
          warehouseId,
        ],
      );
      await client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [admin.rows[0]?.id, roleId],
      );
      await client.query("COMMIT");
      console.log("seeded warehouse admin");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

seed()
  .finally(closePool)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
