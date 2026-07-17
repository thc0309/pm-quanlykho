# T58: Permission catalog và migration cho thông số

## Goal

Thêm quyền `catalog.specs.*` và schema lưu definition/option/value thông số theo danh mục.

## Acceptance Criteria

- [ ] Permission catalog có `catalog.specs.view/create/update/delete`, label tiếng Việt và route mapping.
- [ ] Permission review checklist hoàn tất cho feature `catalog.specs`.
- [ ] Migration thêm bảng definition, option và product value có ràng buộc rõ.
- [ ] DB ràng buộc unique theo category/code, option theo definition/value.
- [ ] Product value dùng typed columns, không dùng JSON tự do.
- [ ] Seed role dev cấp quyền mới cho warehouse admin.

## Verification

- [ ] `npm run db:migrate --prefix backend`
- [ ] `npm test --prefix backend -- --test-name-pattern "permission|admin"`
- [ ] `npm run build --prefix backend`

## Dependencies

- Checkpoint H

## Likely Files

- `backend/db/migrations/020_product_specs.sql`
- `backend/src/modules/permissions.ts`
- `backend/src/db/seed.ts`
- `backend/test/admin.test.ts`

## Recommended Skills

- `vibe-build`
- `api-and-interface-design`
- `security-and-hardening`
- `test-driven-development`
