# T34: Permission catalog và migration reset

## Mục tiêu

Thay toàn bộ permission cũ bằng một catalog `<feature>.<action>` duy nhất dùng chung cho backend, seed và role UI.

## Quyết định đã chốt

Dự án đang development: reset/reseed role và permission; không giữ alias/runtime compatibility cho `*.manage`, `outbound.pick` hoặc tên cũ khác.

## Hướng thực hiện

1. Lập ma trận endpoint hiện tại → feature/action mới, gồm admin, metadata, inventory/stock, document, picking/checking/exception, report và print.
2. Đặt catalog typed tại module hiện có (`admin.ts` hoặc file gần access nếu cần dùng từ nhiều module); mỗi cell UI phải xuất phát từ catalog này.
3. Migration `019_granular_permissions.sql` reset role permission codes dev theo recovery note; seed warehouse admin nhận toàn bộ quyền phù hợp.
4. Update role schema để chỉ nhận code trong catalog, `.min(1)` và reject duplicate/unknown.
5. Chưa thay toàn bộ route check; T35/T36 làm enforcement theo nhóm để diff reviewable.

## Acceptance

- [ ] Catalog chứa mọi feature/action trong SPEC và mapping cho mọi protected endpoint hiện có.
- [ ] Không còn permission cũ trong seed/catalog; master admin vẫn dùng `*`.
- [ ] Role rỗng, code lạ hoặc duplicate bị reject.
- [ ] Migration `019` chạy sau `018` trên DB dev reset và có recovery note.

## Verification

- `npm run db:migrate --prefix backend`
- `npm test --prefix backend -- --test-name-pattern admin`
- `npm run build --prefix backend`
- `rtk rg -n '\.manage|outbound\.(pick|check|ship|resolveDiscrepancy)' backend/src backend/db/seeds` chỉ còn trong tài liệu migration nếu được giải thích.

## Dependencies

T31 để cố định thứ tự migration.

## Likely Files

- `backend/db/migrations/019_granular_permissions.sql`
- `backend/src/modules/admin.ts`
- `backend/src/modules/access.ts`
- `backend/src/db/seed.ts`
- `backend/test/admin.test.ts`

## Skills

`vibe-build`, `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`, `test-driven-development`.

## Không làm

Không duy trì alias quyền cũ và không xây policy engine tổng quát.
