import assert from "node:assert/strict";
import test from "node:test";

import { remainingReturnQuantity, returnDelta } from "../src/modules/returns.js";

test("customer and supplier returns reverse original movement direction", () => {
  assert.equal(returnDelta("customer", 2), 2);
  assert.equal(returnDelta("supplier", 2), -2);
});

test("draft and confirmed claims reduce remaining return quantity", () => {
  assert.equal(remainingReturnQuantity(6, 4), 2);
  assert.equal(remainingReturnQuantity(6, 7), 0);
});
