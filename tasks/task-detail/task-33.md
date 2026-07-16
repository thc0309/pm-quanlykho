# T33: UI user metadata

## Mục tiêu

Hoàn thiện list/create/edit user với phone bắt buộc, metadata optional và avatar preview/upload.

## Điểm bắt đầu trong code

`AccessPage.tsx` đã tách `UsersPage` và `UserCreatePage`; tái sử dụng form/page pattern hiện có, không dựng profile system mới.

## Hướng thực hiện

1. Mở rộng API client types từ T31/T32, giữ upload multipart tách khỏi JSON update nếu route backend tách riêng.
2. Thêm create/edit form với `phone (*)`; giới hạn note và file ngay ở UI nhưng backend vẫn là boundary chính.
3. Hiển thị preview bằng object URL và revoke khi thay file/unmount.
4. Cập nhật user row sau create/edit/upload không reload; có loading/error theo action.
5. List hiển thị avatar fallback, họ tên, email, phone, bộ phận/chức danh, trạng thái; responsive ở 320 px.

## Acceptance

- [ ] Create/edit gửi đủ metadata, phone trống bị chặn và lỗi backend hiển thị tiếng Việt.
- [ ] Preview không rò object URL; avatar mới còn đúng sau reload.
- [ ] List có fallback khi không có avatar và không hard delete user.
- [ ] Keyboard/focus hoạt động cho file input, submit và cancel.

## Verification

- `npm test --prefix frontend -- --run AccessPage`
- `npm run build --prefix frontend`
- Browser evidence nằm ở E2E-018 trong T52.

## Dependencies

T29, T31, T32.

## Likely Files

- `frontend/src/features/admin/AccessPage.tsx`
- `frontend/src/features/admin/AccessPage.test.tsx`
- `frontend/src/lib/api.ts`

## Skills

`vibe-build`, `frontend-ui-engineering`, `security-and-hardening`, `test-driven-development`.

## Không làm

Không profile tự phục vụ cho warehouse user và không crop ảnh phía client.
