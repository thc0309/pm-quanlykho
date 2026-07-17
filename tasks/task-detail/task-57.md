# T57: Route form dùng chung cho đối tác, người dùng và vai trò

## Goal

Chuyển partner/user/role edit sang route form riêng dùng chung create/edit component.

## Acceptance Criteria

- [x] Partner create/edit dùng chung form; list không inline edit.
- [x] User create/edit dùng chung form; avatar và metadata hoạt động ở edit mode.
- [x] Role create/edit dùng chung form; permission matrix load đúng role hiện có.
- [x] Status actions như `Vô hiệu hóa`/`Kích hoạt` vẫn là row action có confirm.

## Verification

- [x] `npm test --prefix frontend -- --run src/features/partners/PartnersPage.test.tsx src/features/admin/AccessPage.test.tsx`
- [x] `npm run build --prefix frontend`

## Dependencies

- T54
- T55

## Likely Files

- `frontend/src/App.tsx`
- `frontend/src/features/partners/PartnersPage.tsx`
- `frontend/src/features/admin/AccessPage.tsx`
- `frontend/src/lib/api.ts`

## Recommended Skills

- `vibe-build`
- `frontend-ui-engineering`
- `security-and-hardening`
- `test-driven-development`
