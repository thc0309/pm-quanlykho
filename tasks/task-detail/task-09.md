# T09: Deliver the minimum catalog and unit slice

## Acceptance

Admin manages category, base unit and conversion; invalid or ambiguous conversion is rejected; no speculative attribute engine is added beyond confirmed needs. Catalog list screens follow the global list/form rule.

## Verification

Conversion unit tests; scoped API tests; browser creates a category and converted unit.

## Evidence

2026-07-15: catalog API tests passed for category creation, base unit creation, converted unit creation, invalid/ambiguous conversion rejection and permission enforcement. Frontend catalog component tests passed for list-only screens, category form and converted-unit form. Browser created category `CAT1507B`, base unit `BOX1507` and converted unit `PCS1507`, then displayed `PCS1507` as `24.000000 Thùng kiểm thử` in the catalog list. Full backend suite passed 25/25, frontend suite passed 15/15 and both production builds passed.

## Dependencies

T07.

## Likely Files

- `backend/db/migrations/005_catalog.sql`
- `backend/src/modules/catalog.ts`
- `backend/test/catalog.test.ts`
- `frontend/src/features/catalog/CatalogPage.tsx`
- `frontend/src/features/catalog/CatalogPage.test.tsx`

## Skills

- `api-and-interface-design`
- `frontend-ui-engineering`
- `test-driven-development`
- `vibe-test`
