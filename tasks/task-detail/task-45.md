# T45: UI partner và role actions

## Mục tiêu

Nối partner update/status hiện có và role update/delete mới, tái sử dụng permission matrix cho edit role.

## Hướng thực hiện

1. Partner: nối PATCH/status client hiện có, gate `.update/.delete`, update row theo response.
2. Role: load permission hiện tại vào matrix T37, submit update T42 và refresh row không reload.
3. Chỉ render hard delete khi có `admin.roles.delete`; confirm trước xóa.
4. Với role đã từng gán, giữ row và hiển thị lỗi 409 tiếng Việt; không tự tháo assignment.
5. Test partner success, role edit prefill, xóa role chưa gán, chặn role đã gán và denied action.

## Acceptance

- [ ] Partner edit/status và role edit/delete dùng API thật, không còn placeholder disabled.
- [ ] Matrix edit phản ánh đúng permission hiện có và không cho rỗng.
- [ ] Role chưa từng gán biến mất khỏi list sau delete; role đã gán giữ nguyên với lỗi rõ ràng.
- [ ] Action tuân theo permission granular.

## Verification

- `npm test --prefix frontend -- --run PartnersPage AccessPage`
- `npm run build --prefix frontend`
- Browser smoke được ghi ở E2E-016 trong T52.

## Dependencies

T37, T38, T42.

## Likely Files

- `frontend/src/features/partners/PartnersPage.tsx`
- `frontend/src/features/admin/AccessPage.tsx`
- Các test tương ứng.

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không thay assignment UX hoặc tự động migrate role đang dùng.
