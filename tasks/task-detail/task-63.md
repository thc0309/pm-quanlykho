# T63: Product create/edit tự render thông số theo danh mục

## Goal

Product form dùng chung create/edit tự tải và render section `Thông số` theo category đang chọn.

## Acceptance Criteria

- [x] Chọn category thì form tải definitions active và render field theo type.
- [x] Required có `(*)`; missing value chặn submit trước khi gọi API khi có thể.
- [x] Đổi category sau khi nhập value có cảnh báo; không âm thầm xóa dữ liệu.
- [x] Edit mode load product spec values hiện có và submit update đúng payload.
- [x] Product create/edit vẫn dùng quyền `products.create` và `products.update`; phần đọc specs dùng quyền xem tương ứng.

## Verification

- [x] `npm test --prefix frontend -- --run src/features/products/ProductsPage.test.tsx`
- [x] `npm run build --prefix frontend`

## Dependencies

- T61
- T62

## Likely Files

- `frontend/src/features/products/ProductsPage.tsx`
- `frontend/src/features/products/ProductsPage.test.tsx`
- `frontend/src/lib/api.ts`

## Recommended Skills

- `vibe-build`
- `frontend-ui-engineering`
- `security-and-hardening`
- `test-driven-development`
