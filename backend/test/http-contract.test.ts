import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { app, createApp } from "../src/app.js";
import { parseJson, parsePagination } from "../src/http/validation.js";

app.get("/__contract/pagination", (c) =>
  c.json({ pagination: parsePagination(c.req.query()) }),
);
app.get("/__contract/error", () => {
  throw new Error("database password must stay private");
});
app.post("/__contract/json", async (c) =>
  c.json(await parseJson(c, z.object({ name: z.string().trim().min(1) }))),
);

test("unknown routes use the stable error shape and request ID", async () => {
  const response = await app.request("/missing", {
    headers: { "x-request-id": "request-123" },
  });

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("x-request-id"), "request-123");
  assert.deepEqual(await response.json(), {
    error: { code: "NOT_FOUND", message: "Endpoint không tồn tại" },
  });
});

test("pagination is bounded and rejects malformed values", async () => {
  const valid = await app.request("/__contract/pagination?page=2&pageSize=50");
  assert.deepEqual(await valid.json(), {
    pagination: { page: 2, pageSize: 50, offset: 50 },
  });

  for (const query of ["page=0", "page=wat", "pageSize=101"]) {
    const response = await app.request(`/__contract/pagination?${query}`);
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
  }
});

test("JSON validation distinguishes malformed and invalid bodies", async () => {
  const malformed = await app.request("/__contract/json", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, "MALFORMED_JSON");

  const invalid = await app.request("/__contract/json", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "" }),
  });
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");
});

test("unexpected errors never leak internal details", async () => {
  const original = console.error;
  console.error = () => undefined;
  const response = await app.request("/__contract/error");
  console.error = original;

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), {
    error: { code: "INTERNAL_ERROR", message: "Lỗi hệ thống" },
  });
});

test("CORS allows configured frontend origins with credentials", async () => {
  const corsApp = createApp({ corsOrigins: ["http://127.0.0.1:5173"] });
  const response = await corsApp.request("/api/auth/login", {
    method: "OPTIONS",
    headers: {
      origin: "http://127.0.0.1:5173",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:5173");
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
  assert.match(response.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /content-type/i);
});

test("CORS does not allow unknown origins", async () => {
  const corsApp = createApp({ corsOrigins: ["http://127.0.0.1:5173"] });
  const response = await corsApp.request("/health", {
    headers: { origin: "http://example.test" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});
