import type { Context } from "hono";
import { z, type ZodType } from "zod";

import { HttpError } from "./errors.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function parsePagination(query: Record<string, string | undefined>) {
  const result = paginationSchema.safeParse(query);
  if (!result.success) {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Tham số phân trang không hợp lệ",
      result.error.flatten(),
    );
  }
  return {
    ...result.data,
    offset: (result.data.page - 1) * result.data.pageSize,
  };
}

export async function parseJson<T>(context: Context, schema: ZodType<T>) {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    throw new HttpError(400, "MALFORMED_JSON", "JSON không hợp lệ");
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Dữ liệu không hợp lệ",
      result.error.flatten(),
    );
  }
  return result.data;
}
