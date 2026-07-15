# T10: Deliver products and barcode lookup

## Acceptance

Admin manages stock products with tracking/FEFO/expiry policy and multiple unique barcodes; scanner lookup returns the correct warehouse product. Product list screens follow the global list/form rule.

## Verification

API tests cover duplicate SKU/barcode and invalid tracking policy; browser creates and resolves products for none/lot/serial tracking.

## Evidence

2026-07-15: product API tests passed for creating `none`, `lot` and `serial` products, duplicate SKU/barcode conflicts, invalid tracking policy rejection and permission enforcement. Product component tests passed for list-only screen, barcode lookup and dedicated create form. Browser created products for `none/lot/serial` tracking and resolved a lot product by barcode (`Tìm thấy: SKU-LOT-*`). Full backend suite passed 28/28, frontend suite passed 18/18 and both production builds passed.

## Dependencies

T08, T09.

## Likely Files

- `backend/db/migrations/006_products.sql`
- `backend/src/modules/products.ts`
- `backend/test/products.test.ts`
- `frontend/src/features/products/ProductsPage.tsx`
- `frontend/src/features/products/ProductsPage.test.tsx`

## Skills

- `api-and-interface-design`
- `frontend-ui-engineering`
- `security-and-hardening`
- `vibe-test`
