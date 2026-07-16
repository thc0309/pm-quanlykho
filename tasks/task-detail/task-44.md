# T44: UI location và product actions

## Mục tiêu

Nối edit/activate/deactivate location và product với API an toàn, permission granular và phản hồi constraint rõ ràng.

## Hướng thực hiện

1. Dùng client T40/T41 và helper T38; mỗi action có permission riêng.
2. Edit form chỉ expose field backend cho phép; SKU/trackingMode hiển thị read-only hoặc không có trong edit payload.
3. Confirm status change, loading/error theo row và update row từ response server.
4. Map conflict còn tồn/workflow/duplicate barcode sang thông báo tiếng Việt, không che mất error code hữu ích.
5. Test cả location/product success, denied action và constraint failure.

## Acceptance

- [ ] Location/product edit/status hoạt động không reload.
- [ ] UI không gửi field bất biến và không hiển thị action trái quyền.
- [ ] Conflict an toàn được giải thích rõ; state không đổi khi API fail.
- [ ] Layout/action usable ở 320 px và keyboard.

## Verification

- `npm test --prefix frontend -- --run LocationsPage ProductsPage`
- `npm run build --prefix frontend`
- Browser smoke được ghi ở E2E-016 trong T52.

## Dependencies

T38, T40, T41.

## Likely Files

- `frontend/src/features/locations/LocationsPage.tsx`
- `frontend/src/features/products/ProductsPage.tsx`
- Các test tương ứng.

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không bulk action hoặc product tracking migration.
