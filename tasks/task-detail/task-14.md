# T14: Deliver inventory and traceability views

## Acceptance

Users can view paginated `on_hand/committed/available`, lots/serials and movement history; warehouse isolation and bounded filters apply. Inventory/traceability list screens follow the global list/form rule.

## Verification

API tests prove totals and no leakage; browser checks loading/error/empty/filter/pagination states.

## Dependencies

T12, T13.

## Likely Files

- `backend/src/modules/inventory.ts`
- `backend/test/inventory.test.ts`
- `frontend/src/features/inventory/InventoryPage.tsx`
- `frontend/src/features/inventory/InventoryPage.test.tsx`

## Skills

- `api-and-interface-design`
- `frontend-ui-engineering`
- `performance-optimization`
- `vibe-test`
