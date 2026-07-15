# T11: Deliver partner management

## Acceptance

Admin manages scoped customer/supplier records with unique codes and validated contact/tax fields. Partner list screens follow the global list/form rule.

## Verification

API/component tests cover create/update/disable, duplicate code and warehouse isolation.

## Evidence

2026-07-15: partner API tests passed for scoped create, update, disable, duplicate code conflict and cross-warehouse denial/list isolation. Partner component tests passed for list-only screen and dedicated create form. Full backend suite passed 30/30, frontend suite passed 20/20 and both production builds passed.

## Dependencies

T07.

## Likely Files

- `backend/src/modules/partners.ts`
- `backend/test/partners.test.ts`
- `frontend/src/features/partners/PartnersPage.tsx`
- `frontend/src/features/partners/PartnersPage.test.tsx`

## Skills

- `api-and-interface-design`
- `frontend-ui-engineering`
- `security-and-hardening`
- `vibe-test`
