import { randomUUID } from "node:crypto";
import { Hono } from "hono";

import { errorBody, HttpError } from "./http/errors.js";

export function createApp() {
  const app = new Hono();

app.use("*", async (c, next) => {
  const supplied = c.req.header("x-request-id");
  const requestId =
    supplied && /^[A-Za-z0-9._-]{1,100}$/.test(supplied)
      ? supplied
      : randomUUID();
  c.header("x-request-id", requestId);
  await next();
});

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "warehouse-suite-backend",
  }),
);

app.notFound((c) =>
  c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Endpoint không tồn tại",
      },
    },
    404,
  ),
);

app.onError((error, c) => {
  if (error instanceof HttpError) {
    return c.json(errorBody(error), error.status);
  }
  console.error("Unhandled API error", {
    requestId: c.res.headers.get("x-request-id"),
  });
  return c.json(errorBody(new HttpError(500, "INTERNAL_ERROR", "Lỗi hệ thống")), 500);
});

  return app;
}

export const app = createApp();
