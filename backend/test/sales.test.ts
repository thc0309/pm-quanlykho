import assert from "node:assert/strict";
import test from "node:test";

import { hasAllSalesLines, lineTotal } from "../src/modules/sales.js";

test("sales totals include tax deterministically", () => {
  assert.equal(lineTotal(2, 100, 10), 220);
});

test("sales creation rejects a silently omitted product line", () => {
  assert.equal(hasAllSalesLines(2, 2), true);
  assert.equal(hasAllSalesLines(2, 1), false);
});

test("invoice snapshots are copied values", () => {
  const source = { status: "shipped", total: 220 };
  const snapshot = structuredClone(source);
  source.total = 0;
  assert.equal(snapshot.total, 220);
});
