# T62: UI quản lý Thông số trong danh mục

## Goal

Thêm action `Thông số` ở category list và màn hình quản lý definitions/options theo category.

## Acceptance Criteria

- [x] Category row có action `Thông số` khi có `catalog.specs.view`.
- [x] Admin thêm/sửa/vô hiệu hóa/kích hoạt definition và option theo quyền.
- [x] User thiếu quyền ghi chỉ xem được hoặc bị ẩn action; gọi API trực tiếp bị backend trả `403`.
- [x] UI validate `select` phải có option, required/min/max/unit đúng nhãn.
- [x] Row update không cần reload; lỗi hiển thị tiếng Việt.

## Verification

- [x] `npm test --prefix frontend -- --run src/features/catalog/CatalogPage.test.tsx`
- [x] `npm run build --prefix frontend`

## Dependencies

- T61

## Likely Files

- `frontend/src/App.tsx`
- `frontend/src/features/catalog/CatalogPage.tsx`
- `frontend/src/features/catalog/CatalogPage.test.tsx`
- `frontend/src/lib/api.ts`

## Recommended Skills

- `vibe-build`
- `frontend-ui-engineering`
- `test-driven-development`
