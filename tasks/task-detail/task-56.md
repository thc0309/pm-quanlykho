# T56: Route form dùng chung cho vị trí và sản phẩm

## Goal

Chuyển location/product create và edit sang route form riêng dùng chung component.

## Acceptance Criteria

- [x] `Thêm vị trí` và `Sửa vị trí` dùng cùng form route create/edit.
- [x] `Thêm sản phẩm` và `Sửa sản phẩm` dùng cùng form route create/edit.
- [x] Product edit giữ rule an toàn hiện có: không sửa tracking/SKU khi đã có lịch sử.
- [x] Status action vẫn là row action có confirm.
- [x] List không còn inline edit form cho location/product.

## Verification

- [x] `npm test --prefix frontend -- --run src/features/locations/LocationsPage.test.tsx src/features/products/ProductsPage.test.tsx`
- [x] `npm run build --prefix frontend`

## Dependencies

- T54
- T55

## Likely Files

- `frontend/src/App.tsx`
- `frontend/src/features/locations/LocationsPage.tsx`
- `frontend/src/features/products/ProductsPage.tsx`
- `frontend/src/lib/api.ts`

## Recommended Skills

- `vibe-build`
- `frontend-ui-engineering`
- `test-driven-development`
