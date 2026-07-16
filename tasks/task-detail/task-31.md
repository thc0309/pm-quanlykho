# T31: Migration và API user metadata

## Mục tiêu

Thêm hồ sơ user có `phone` bắt buộc qua một migration mới, API typed và seed dev chạy lại được.

## Quyết định đã chốt

- Reset/reseed dữ liệu development; không tạo phone ngẫu nhiên.
- `phone` là `NOT NULL`; master và warehouse admin seed nhận phone từ env/config seed rõ ràng.
- Migration riêng: `018_user_metadata.sql`; permission nằm ở `019`.

## Hướng thực hiện

1. Viết migration thêm `phone`, `avatar_url`, `employee_code`, `job_title`, `department`, `note`; kèm recovery note cho reset DB dev.
2. Mở rộng `AdminUser`, store queries và Zod create/update schema; trim, giới hạn độ dài và chuẩn hóa phone theo một format đã ghi trong test.
3. Thêm route update user trong warehouse scope; giữ status endpoint hiện có và audit create/update.
4. Cập nhật seed/env validation để mọi user seed hợp lệ với `phone NOT NULL`.
5. Cập nhật frontend API types/methods nhưng chưa dựng UI.

## Acceptance

- [ ] Migration sạch trên DB dev mới; seed chạy thành công sau reset.
- [ ] Create/update/list trả metadata nhưng không lộ `password_hash` hay dữ liệu ngoài warehouse.
- [ ] Email, fullName, phone bắt buộc; metadata khác optional và bounded.
- [ ] Audit create/update giữ entity, actor và warehouse đúng.

## Verification

- `npm run db:migrate --prefix backend`
- `npm test --prefix backend -- --test-name-pattern admin`
- `npm run build --prefix backend`

## Dependencies

Không có.

## Likely Files

- `backend/db/migrations/018_user_metadata.sql`
- `backend/src/modules/admin.ts`
- `backend/src/db/seed.ts`
- `backend/test/admin.test.ts`
- `frontend/src/lib/api.ts`

## Skills

`vibe-build`, `api-and-interface-design`, `security-and-hardening`, `test-driven-development`.

## Không làm

Không upload avatar và không đổi permission trong task này.
