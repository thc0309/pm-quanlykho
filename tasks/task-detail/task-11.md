# T11: Deliver partner management

## Acceptance

Admin manages scoped customer/supplier records with unique codes and validated contact/tax fields. Partner list screens follow the global list/form rule.

## Verification

API/component tests cover create/update/disable, duplicate code and warehouse isolation.

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
