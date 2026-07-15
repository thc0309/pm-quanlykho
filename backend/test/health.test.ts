import assert from "node:assert/strict";
import test from "node:test";

import { app } from "../src/app.js";

test("GET /health returns the stable service envelope", async () => {
  const response = await app.request("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "warehouse-suite-backend",
  });
});
