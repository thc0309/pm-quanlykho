import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateTransferLines,
  hasExactTransferLineSet,
  transferReconciliation,
} from "../src/modules/transfers.js";

test("transfer reconciles source plus transit plus destination", () => {
  assert.equal(transferReconciliation(8, 2, 0), 10);
  assert.equal(transferReconciliation(8, 0, 2), 10);
});

test("destination must receive every transfer line exactly once", () => {
  assert.equal(hasExactTransferLineSet(["a", "b"], ["b", "a"]), true);
  assert.equal(hasExactTransferLineSet(["a", "b"], ["a"]), false);
  assert.equal(hasExactTransferLineSet(["a", "b"], ["a", "a"]), false);
});

test("duplicate source balances are aggregated before availability validation", () => {
  assert.deepEqual(
    aggregateTransferLines([
      { stockBalanceId: "balance", quantity: 2 },
      { stockBalanceId: "balance", quantity: 3 },
    ]),
    [{ stockBalanceId: "balance", quantity: 5 }],
  );
});
