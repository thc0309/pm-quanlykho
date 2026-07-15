# T07: Deliver warehouse user and role administration

## Acceptance

Warehouse admin can list/create/disable users, define roles and assign permissions; denied controls are absent but API remains authoritative. User/role list screens follow the global list/form rule: list-only screen, `Thêm` links to a separate form route and each row has an icon `Action` column.

## Verification

Backend tests for scoped CRUD; component/browser test creates picker and checker roles and confirms denied navigation.

## Evidence

2026-07-15: scoped admin API tests passed 3/3, including denied permission and cross-warehouse status changes. Access component tests passed 4/4, including role assignment; Chrome created picker/checker roles, created a warehouse user and assigned the picker role through the real API. Full suite passed 25/25, lint had 0 errors and both production builds passed.

## Dependencies

T05, T06.

## Likely Files

- `backend/src/modules/admin.ts`
- `backend/test/admin.test.ts`
- `frontend/src/features/admin/AccessPage.tsx`
- `frontend/src/features/admin/AccessPage.test.tsx`
- `frontend/src/layout/AppSidebar.tsx`

## Skills

- `api-and-interface-design`
- `security-and-hardening`
- `frontend-ui-engineering`
- `vibe-test`
