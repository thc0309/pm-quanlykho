export type StockDocumentType =
  | "receipt"
  | "issue"
  | "adjustment"
  | "transfer_out"
  | "transfer_in"
  | "return_customer"
  | "return_supplier"
  | "stock_count";

export function stockKey(input: {
  warehouseId: string;
  locationId: string;
  productId: string;
  lotCode?: string | null;
  serialCode?: string | null;
}) {
  return [
    input.warehouseId,
    input.locationId,
    input.productId,
    input.lotCode ?? "",
    input.serialCode ?? "",
  ].join(":");
}

export function nextOnHand(current: number, quantityDelta: number) {
  const value = current + quantityDelta;
  if (value < 0) throw new Error("NEGATIVE_STOCK");
  return value;
}
