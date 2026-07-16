# T43: UI category và unit actions

## Mục tiêu

Biến các action disabled thành edit/activate/deactivate thật cho category và unit, cập nhật row tại chỗ.

## Hướng thực hiện

1. Dùng API methods T39 và permission helper T38 để hiển thị action theo `.update/.delete`.
2. Reuse form field hiện có trong edit page/modal nhỏ; không tạo generic CRUD framework.
3. Confirm trước status change; loading/error gắn đúng row để không khóa toàn bảng.
4. Sau success thay row trong state, giữ filter/page; lỗi 409/422 hiển thị tiếng Việt.
5. Test hidden action, success update/status và constraint error.

## Acceptance

- [ ] Edit/status hoạt động không reload và state row khớp response server.
- [ ] Không dùng chữ `Xóa` cho deactivate; action trái quyền không render.
- [ ] Confirm, loading, success/error và keyboard focus hoạt động.

## Verification

- `npm test --prefix frontend -- --run CatalogPage`
- `npm run build --prefix frontend`
- Browser smoke được ghi ở E2E-016 trong T52.

## Dependencies

T38, T39.

## Likely Files

- `frontend/src/features/catalog/CatalogPage.tsx`
- `frontend/src/features/catalog/CatalogPage.test.tsx`
- `frontend/src/lib/api.ts`

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không thêm bulk edit/delete hoặc optimistic update trước response server.
