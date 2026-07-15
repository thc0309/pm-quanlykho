# T13: Deliver receiving with lot/serial

## Acceptance

Authorized user creates and confirms a receipt into a location; confirmation increases stock once; expiry-required lot and serial rules are enforced. Receipt list screens follow the global list/form rule.

## Verification

API/UI tests cover none/lot/serial receipt, FEFO metadata and idempotent confirm; browser receives stock usable by outbound.

## Dependencies

T10, T11, T12.

## Likely Files

- `backend/db/migrations/008_receipts.sql`
- `backend/src/modules/receipts.ts`
- `backend/test/receipts.test.ts`
- `frontend/src/features/receipts/ReceiptPage.tsx`
- `frontend/src/features/receipts/ReceiptPage.test.tsx`

## Skills

- `api-and-interface-design`
- `doubt-driven-development`
- `frontend-ui-engineering`
- `vibe-test`
