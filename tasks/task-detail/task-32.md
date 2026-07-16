# T32: Avatar upload và resize tối ưu

## Mục tiêu

Cho admin upload avatar an toàn, lưu ảnh WebP nhỏ gọn trên filesystem và chỉ lưu URL/key trong database.

## Quyết định đã chốt

- Input: JPEG/PNG/WebP tối đa 5 MB, xác thực bằng magic bytes thay vì tin MIME/extension.
- Output: crop vuông theo tâm, áp dụng orientation, 256x256 WebP, bỏ metadata, tối đa 200 KB.
- Có thể dùng `sharp` nếu stack hiện tại không có xử lý ảnh phù hợp; không tự xây codec.

## Hướng thực hiện

1. Chốt route multipart update avatar dưới module admin và cùng permission/warehouse scope với update user.
2. Parse file có giới hạn trước khi decode; từ chối ảnh lỗi, pixel dimensions bất thường và định dạng ngoài allowlist bằng lỗi tiếng Việt.
3. Resize vào file tạm, kiểm tra output, đổi tên atomically sang key ngẫu nhiên không chứa input filename.
4. Chỉ cập nhật `avatar_url` sau khi file mới ghi thành công; xóa file cũ sau commit hoặc cleanup an toàn khi thất bại.
5. Serve thư mục upload read-only với content type cố định; audit thành công, không log binary/path tuyệt đối.
6. Test file hợp lệ, giả MIME, quá dung lượng, cross-warehouse, cleanup và output dimensions/size.

## Acceptance

- [ ] Không thể upload file không phải ảnh, ảnh quá 5 MB hoặc ảnh ngoài warehouse scope.
- [ ] Output luôn 256x256 WebP, không metadata và không quá 200 KB với fixtures đã chọn.
- [ ] DB chỉ lưu URL/key; lỗi giữa chừng không làm mất avatar cũ hoặc để orphan file có thể dự đoán.
- [ ] API trả lỗi tiếng Việt ổn định và có audit khi thành công.

## Verification

- `npm test --prefix backend -- --test-name-pattern avatar`
- `npm run build --prefix backend`
- Kiểm tra fixture output bằng metadata decoder trong test, không chỉ kiểm tra extension.

## Dependencies

T31.

## Likely Files

- `backend/src/modules/admin.ts`
- `backend/src/modules/avatar.ts` nếu logic xử lý ảnh không đọc được khi đặt trong admin
- `backend/src/index.ts`
- `backend/test/admin.test.ts`
- `backend/package.json` và lockfile nếu thêm `sharp`

## Skills

`vibe-build`, `security-and-hardening`, `source-driven-development`, `test-driven-development`.

## Không làm

Không cloud storage, CDN, nhiều kích thước hoặc crop UI tùy chỉnh.
