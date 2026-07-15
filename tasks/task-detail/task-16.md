# T16: Deliver the picker workflow

## Acceptance

One active picker claims/resumes a phiếu, must scan location then product/lot/serial, and confirms `picked`; progress persists per scan; `on_hand` remains unchanged and reservation becomes `picked`. Picker claim/resume list screens follow the global list/form rule; scan execution screens can remain workflow-focused.

## Verification

Tests cover wrong shelf/item/lot/serial, FEFO override denial, duplicate scan, resume and competing picker; mobile browser completes a pick.

## Dependencies

T15.

## Likely Files

- `backend/db/migrations/010_picking.sql`
- `backend/src/modules/picking.ts`
- `backend/test/picking.test.ts`
- `frontend/src/features/picking/PickingPage.tsx`
- `frontend/src/features/picking/PickingPage.test.tsx`

## Skills

- `api-and-interface-design`
- `doubt-driven-development`
- `frontend-ui-engineering`
- `browser-testing-with-devtools`
- `vibe-test`
