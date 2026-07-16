# T29: Chuẩn hóa label bắt buộc cho form lõi

## Mục tiêu

Mọi field bắt buộc trong auth, user/role và metadata lõi hiển thị `(*)` ngay trong accessible label; field optional không có dấu này.

## Điểm bắt đầu trong code

- Các page auth/admin/catalog/location/product/partner đang tự viết label; component `frontend/src/components/form/Label.tsx` đã được dùng ở nhiều nơi.
- Nguồn xác định bắt buộc là `required` ở HTML và schema backend, không suy đoán theo placeholder.

## Hướng thực hiện

1. Lập bảng field bắt buộc/optional bằng cách đối chiếu form với Zod schema backend.
2. Ưu tiên truyền text `Tên trường (*)` vào component `Label` hiện có; không tạo abstraction mới chỉ để thêm dấu.
3. Đồng bộ `required`, accessible name và thông báo validation tiếng Việt.
4. Cập nhật component test theo accessible label, gồm ít nhất một field required và một field optional mỗi nhóm form.

## Acceptance

- [ ] Auth, user/role, category/unit, location, product và partner có marker đúng schema.
- [ ] Field optional không có `(*)`; keyboard/screen reader tìm được label đầy đủ.
- [ ] Không dùng màu hoặc placeholder làm dấu hiệu bắt buộc duy nhất.

## Verification

- `npm test --prefix frontend -- --run AccessPage CatalogPage LocationsPage ProductsPage PartnersPage AuthPage`
- `npm run build --prefix frontend`
- Ghi bằng chứng responsive/accessibility vào T52, không chạy browser trong task này.

## Dependencies

Không có.

## Likely Files

- `frontend/src/features/auth/AuthPage.tsx`
- `frontend/src/features/admin/AccessPage.tsx`
- `frontend/src/features/catalog/CatalogPage.tsx`
- `frontend/src/features/locations/LocationsPage.tsx`
- `frontend/src/features/products/ProductsPage.tsx`
- `frontend/src/features/partners/PartnersPage.tsx`
- Các test tương ứng.

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không đổi layout hoặc tạo form component library mới.
