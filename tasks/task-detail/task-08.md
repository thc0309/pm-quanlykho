# T08: Deliver warehouse locations

## Acceptance

Admin manages `storage/staging/shipping` locations with warehouse-unique code/barcode; scan lookup cannot cross warehouse. Location list screen follows the global list/form rule: list-only screen, `Thêm` links to a separate form route and each row has an icon `Action` column.

## Verification

API/component tests cover duplicates, invalid type and barcode lookup; browser creates one location of each type.

## Evidence

2026-07-15: location API tests passed 2/2 for all three types, duplicate code/barcode, invalid type and warehouse-scoped scan lookup. Component test passed; Chrome created and displayed `storage`, `staging` and `shipping` locations through the real API. Full suite passed 28/28, lint had 0 errors and both production builds passed.

## Dependencies

T07.

## Likely Files

- `backend/db/migrations/004_locations.sql`
- `backend/src/modules/locations.ts`
- `backend/test/locations.test.ts`
- `frontend/src/features/locations/LocationsPage.tsx`
- `frontend/src/features/locations/LocationsPage.test.tsx`

## Skills

- `api-and-interface-design`
- `frontend-ui-engineering`
- `security-and-hardening`
- `vibe-test`
