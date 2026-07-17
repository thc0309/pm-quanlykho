# T64: Hiển thị thông số trong danh sách/chi tiết sản phẩm

## Goal

Hiển thị giá trị thông số trong product list/detail/edit mà không làm bảng vỡ layout.

## Acceptance Criteria

- [x] Product edit/detail hiển thị toàn bộ spec values, kể cả definition inactive đã có dữ liệu.
- [x] Product list hiển thị tóm tắt thông số gọn hoặc vùng mở rộng.
- [x] Không ép tất cả thông số vào nhiều cột động gây vỡ bảng.
- [x] Empty/loading/error states rõ khi category chưa có thông số.

## Verification

- [x] `npm test --prefix frontend -- --run src/features/products/ProductsPage.test.tsx`
- [x] `npm run build --prefix frontend`

## Dependencies

- T63

## Likely Files

- `frontend/src/features/products/ProductsPage.tsx`
- `frontend/src/features/products/ProductsPage.test.tsx`

## Recommended Skills

- `vibe-build`
- `frontend-ui-engineering`
- `test-driven-development`
