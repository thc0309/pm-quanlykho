import assert from "node:assert/strict";
import test from "node:test";
import { selectPickCandidate, type PickCandidate } from "../src/modules/picking.js";

const rows: PickCandidate[] = [
  { reservationId:"early", quantity:"1", scanned:"0", locationBarcode:"A-01", sku:"SKU-A", lotCode:"LOT-EARLY", serialCode:null },
  { reservationId:"late", quantity:"1", scanned:"0", locationBarcode:"A-01", sku:"SKU-A", lotCode:"LOT-LATE", serialCode:null },
];
test("picker requires the reserved shelf and item", () => {
  assert.throws(() => selectPickCandidate(rows,{locationBarcode:"B-01",itemBarcode:"LOT-EARLY"}),/WRONG_LOCATION/);
  assert.throws(() => selectPickCandidate(rows,{locationBarcode:"A-01",itemBarcode:"UNKNOWN"}),/WRONG_ITEM/);
});
test("picker denies FEFO override and duplicate scans", () => {
  assert.throws(() => selectPickCandidate(rows,{locationBarcode:"A-01",itemBarcode:"LOT-LATE"}),/FEFO_DENIED/);
  assert.throws(() => selectPickCandidate([{...rows[0]!,scanned:"1"}],{locationBarcode:"A-01",itemBarcode:"LOT-EARLY"}),/DUPLICATE_SCAN/);
});
test("picker accepts the first outstanding FEFO key", () => {
  assert.equal(selectPickCandidate(rows,{locationBarcode:"A-01",itemBarcode:"LOT-EARLY"}).reservationId,"early");
});
