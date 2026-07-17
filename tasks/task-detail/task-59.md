# T59: API quản lý thông số danh mục

## Goal

Thêm API CRUD/status cho spec definitions và options theo category.

## Acceptance Criteria

- [ ] List/create/update/status spec definition theo category và warehouse scope.
- [ ] API enforce `catalog.specs.view/create/update/delete`; thiếu quyền trả `403` kể cả gọi trực tiếp.
- [ ] `select` bắt buộc có option; `number` hỗ trợ unit/min/max.
- [ ] Code duy nhất trong danh mục.
- [ ] Không hard delete definition/option đã có product value; dùng status `inactive`.
- [ ] Audit create/update/status cho definition và option.

## Verification

- [ ] `npm test --prefix backend -- --test-name-pattern "catalog spec"`
- [ ] `npm run build --prefix backend`

## Dependencies

- T58

## Likely Files

- `backend/src/modules/catalog-specs.ts`
- `backend/src/index.ts`
- `backend/src/modules/permissions.ts`
- `backend/test/catalog-specs.test.ts`

## Recommended Skills

- `vibe-build`
- `api-and-interface-design`
- `security-and-hardening`
- `test-driven-development`
