# T65: Browser E2E cho route form và thông số

## Goal

Chạy browser E2E cho create/edit route rule và product specifications, ghi evidence.

## Acceptance Criteria

- [ ] E2E-020 create/edit route rule pass.
- [ ] E2E-021 product specifications pass.
- [ ] E2E cover user thiếu quyền update/spec update: UI ẩn action và direct API trả `403`.
- [ ] Evidence có URL, role, viewport, console/network và screenshot khi khả dụng.

## Verification

- [ ] `$vibe-e2e E2E-020`
- [ ] `$vibe-e2e E2E-021`

## Dependencies

- T57
- T64

## Likely Files

- `tasks/test-result.md`

## Recommended Skills

- `vibe-e2e`
- `browser-testing-with-devtools`
