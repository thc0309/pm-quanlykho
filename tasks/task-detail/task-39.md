# T39: API update/status cho category và unit

## Mục tiêu

Bổ sung update tên và activate/deactivate category/unit trong warehouse scope, có constraint, audit và client method.

## Hướng thực hiện

1. Thêm Zod schema strict cho update/status; chỉ cho field an toàn, không đổi code/conversion đã được sử dụng.
2. Thêm store/route parameterized query với warehouse filter và permission từ T35.
3. Khi deactivate, kiểm tra reference cần thiết; dùng 409 cho conflict, 404 cho ngoài scope/not found, 422 cho validation.
4. Audit update/status sau mutation thành công.
5. Thêm API client methods typed; chưa dựng UI.

## Acceptance

- [ ] Category/unit update/status đúng warehouse và đúng permission.
- [ ] Duplicate/reference conflict không làm thay đổi dữ liệu.
- [ ] 403/404/409/422 có test và error envelope ổn định.
- [ ] Mọi mutation thành công có audit.

## Verification

- `npm test --prefix backend -- --test-name-pattern catalog`
- `npm run build --prefix backend`

## Dependencies

T35.

## Likely Files

- `backend/src/modules/catalog.ts`
- `backend/test/catalog.test.ts`
- `frontend/src/lib/api.ts`

## Skills

`vibe-build`, `api-and-interface-design`, `security-and-hardening`, `test-driven-development`.

## Không làm

Không hard delete dữ liệu đã tham chiếu và không sửa conversion factor.
