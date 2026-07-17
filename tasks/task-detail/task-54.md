# T54: Detail API và client cho form sửa metadata

## Goal

Tạo contract đọc chi tiết theo `id` cho form `:id/edit` của metadata, không phụ thuộc state từ list page.

## Acceptance Criteria

- [x] Có API/client lấy chi tiết cho category, unit, location, product, partner, user và role.
- [x] API dùng quyền `*.view`, enforce warehouse scope và trả `404` khi không tồn tại/ngoài scope.
- [x] Route/API detail được map trong permission review cho create/edit form.
- [x] Không đổi hành vi create/update/status hiện có.

## Verification

- [x] `npm test --prefix backend -- --test-name-pattern "catalog|location|product|partner|admin"`
- [x] `npm run build --prefix backend`
- [x] `npm test --prefix frontend -- --run src/lib/api.test.ts`

## Dependencies

- T53

## Likely Files

- `backend/src/modules/catalog.ts`
- `backend/src/modules/locations.ts`
- `backend/src/modules/products.ts`
- `backend/src/modules/partners.ts`
- `backend/src/modules/admin.ts`
- `backend/src/modules/permissions.ts`
- `frontend/src/lib/api.ts`

## Recommended Skills

- `vibe-build`
- `api-and-interface-design`
- `security-and-hardening`
- `test-driven-development`
