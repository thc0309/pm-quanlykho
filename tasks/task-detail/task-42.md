# T42: API update và hard delete role an toàn

## Mục tiêu

Cho sửa role và xóa role chỉ khi chưa từng gán user, có transaction, permission và audit đầy đủ.

## Hướng thực hiện

1. Thêm update schema cho name + permission codes từ catalog; code role bất biến trừ khi SPEC yêu cầu khác.
2. Replace permission set trong transaction, `.min(1)`, reject unknown/duplicate.
3. Delete route kiểm tra lịch sử/current reference trong `user_roles` hoặc dữ liệu audit phù hợp; role đã từng gán trả 409.
4. Warehouse scope và `admin.roles.update/delete` được enforce ở API.
5. Audit update/delete; expose client methods cho T45.

## Acceptance

- [ ] Update role không thể lưu permission rỗng hoặc code ngoài catalog.
- [ ] Role chưa từng gán xóa được; role đã/đang gán bị chặn rõ ràng bằng tiếng Việt.
- [ ] Cross-warehouse và thiếu permission trả 403/404 đúng contract.
- [ ] Update permission là atomic và có audit.

## Verification

- `npm test --prefix backend -- --test-name-pattern admin`
- `npm run build --prefix backend`

## Dependencies

T34.

## Likely Files

- `backend/src/modules/admin.ts`
- `backend/test/admin.test.ts`
- `frontend/src/lib/api.ts`

## Skills

`vibe-build`, `api-and-interface-design`, `security-and-hardening`, `test-driven-development`.

## Không làm

Không soft-delete role và không tự động gỡ role khỏi user để xóa.
