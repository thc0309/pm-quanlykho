# T55: Route form dùng chung cho danh mục và đơn vị

## Goal

Chuyển category/unit create và edit sang route form riêng dùng chung component.

## Acceptance Criteria

- [x] `Thêm danh mục` dùng `/catalog/categories/create`; `Sửa` dùng `/catalog/categories/:id/edit`.
- [x] `Thêm đơn vị` dùng `/catalog/units/create`; `Sửa` dùng `/catalog/units/:id/edit`.
- [x] Create/edit dùng chung form component, tự đổi title/button/API theo mode.
- [x] Edit mode có loading/error/not found và không submit trước khi load xong.
- [x] List không còn inline edit form cho category/unit.

## Verification

- [x] `npm test --prefix frontend -- --run src/features/catalog/CatalogPage.test.tsx`
- [x] `npm run build --prefix frontend`

## Dependencies

- T54

## Likely Files

- `frontend/src/App.tsx`
- `frontend/src/features/catalog/CatalogPage.tsx`
- `frontend/src/features/catalog/CatalogPage.test.tsx`
- `frontend/src/lib/api.ts`

## Recommended Skills

- `vibe-build`
- `frontend-ui-engineering`
- `test-driven-development`
