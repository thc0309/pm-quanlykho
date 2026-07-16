# T35: Enforce permission chi tiết cho admin và metadata

## Mục tiêu

Mỗi endpoint admin/users/roles/location/catalog/product/partner kiểm tra đúng feature/action mới thay vì một quyền quản lý chung.

## Hướng thực hiện

1. Dùng bảng endpoint → permission từ T34; truyền permission cụ thể tại từng route, không tạo actor mặc định có quyền quá rộng.
2. GET dùng `.view`, POST dùng `.create`, PATCH/PUT dùng `.update`, status/hard delete dùng `.delete` theo semantics SPEC.
3. Giữ master admin bypass `*`, warehouse scope và error envelope hiện có.
4. Viết table-driven integration tests: mỗi domain có allow action, deny sibling action và cross-warehouse case.
5. Kiểm tra audit chỉ xảy ra sau mutation thành công.

## Acceptance

- [ ] User chỉ có `.view` không thể create/update/delete bằng direct API.
- [ ] Không endpoint admin/metadata nào còn dùng quyền cũ hoặc chỉ dựa vào UI.
- [ ] Warehouse isolation và master admin behavior không đổi.
- [ ] 403 không làm mutation hoặc ghi audit thành công giả.

## Verification

- `npm test --prefix backend -- --test-name-pattern "access|admin|catalog|location|product|partner"`
- `npm run build --prefix backend`
- Tìm toàn bộ `requireAccess` trong các module nêu trên và đối chiếu bảng mapping.

## Dependencies

T34.

## Likely Files

- `backend/src/modules/{access,admin,catalog,locations,products,partners}.ts`
- Các backend test tương ứng.

## Skills

`vibe-build`, `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`, `test-driven-development`.

## Không làm

Không thay permission của chứng từ/report/print; thuộc T36.
