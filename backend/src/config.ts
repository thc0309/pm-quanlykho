import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().optional(),
});

const env = EnvSchema.parse(process.env);

function parseCorsOrigins(value: string | undefined, nodeEnv: typeof env.NODE_ENV) {
  const origins =
    value ?? (nodeEnv === "development" ? "http://127.0.0.1:5173,http://localhost:5173" : "");
  return origins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  ...env,
  CORS_ORIGINS: parseCorsOrigins(env.CORS_ORIGINS, env.NODE_ENV),
};
