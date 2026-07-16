# T40: API update/status an toàn cho location

## Mục tiêu

Cho sửa name/barcode/type và activate/deactivate location khi không vi phạm tồn kho hoặc workflow đang dùng.

## Hướng thực hiện

1. Định nghĩa schema update/status strict; code bất biến trong task này nếu đổi code ảnh hưởng scan/history.
2. Update dưới warehouse scope và permission granular; giữ unique code/barcode parameterized.
3. Trước deactivate hoặc đổi type, kiểm tra stock balance khác 0 và reference active trong stock document, picking/checking/staging.
4. Đặt check và mutation trong transaction/lock phù hợp để tránh TOCTOU.
5. Audit update/status; expose typed client methods.

## Acceptance

- [ ] Duplicate code/barcode trả 409; invalid payload trả 422.
- [ ] Không deactivate location còn tồn hoặc đang được workflow/chứng từ active dùng.
- [ ] Cross-warehouse/not found không lộ dữ liệu.
- [ ] Audit chỉ ghi sau mutation thành công.

## Verification

- `npm test --prefix backend -- --test-name-pattern location`
- `npm run build --prefix backend`

## Dependencies

T35.

## Likely Files

- `backend/src/modules/locations.ts`
- `backend/test/locations.test.ts`
- `frontend/src/lib/api.ts`

## Skills

`vibe-build`, `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`, `test-driven-development`.

## Không làm

Không hard delete location và không đổi stock movement lịch sử.
