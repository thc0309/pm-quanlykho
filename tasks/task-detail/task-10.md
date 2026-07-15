# T10: Deliver products and barcode lookup

## Acceptance

Admin manages stock products with tracking/FEFO/expiry policy and multiple unique barcodes; scanner lookup returns the correct warehouse product. Product list screens follow the global list/form rule.

## Verification

API tests cover duplicate SKU/barcode and invalid tracking policy; browser creates and resolves products for none/lot/serial tracking.

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
