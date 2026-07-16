# T52: Browser E2E cho rule mới

## Mục tiêu

Chạy E2E-015 đến E2E-019 bằng app/API/database thật và ghi evidence tái kiểm chứng được.

## Hướng thực hiện

1. Đọc `tasks/test-plan.md`, chuẩn bị DB dev/test đã migrate/reseed và user/role đúng permission; không bypass API.
2. Chạy từng case riêng bằng `vibe-e2e`, ghi URL, role, viewport, bước, kết quả UI, console/network và screenshot path.
3. E2E-015 kiểm required/optional marker tại 320/768/1440 px và keyboard.
4. E2E-016 kiểm metadata actions, xóa role chưa gán và chặn role đã gán.
5. E2E-017 tạo PO/return hai dòng; E2E-018 kiểm ảnh output/persistence; E2E-019 gọi cả UI và direct API với partial permission.
6. Case không PASS phải ghi FAIL/BLOCKED cùng bằng chứng và issue cụ thể, không sửa product code trong task E2E nếu chưa mở task fix.

## Acceptance

- [ ] E2E-015..019 mỗi case có PASS/FAIL/BLOCKED và evidence đầy đủ.
- [ ] Không có PASS chỉ dựa trên component test hoặc quan sát UI khi chưa kiểm network/API cần thiết.
- [ ] Console không có lỗi bất ngờ trong flow PASS.
- [ ] Findings được ghi vào `tasks/test-result.md` bằng tiếng Việt.

## Verification

- `$vibe-e2e E2E-015`
- `$vibe-e2e E2E-016`
- `$vibe-e2e E2E-017`
- `$vibe-e2e E2E-018`
- `$vibe-e2e E2E-019`

## Dependencies

T33, T43-T51.

## Likely Files

- `tasks/test-result.md`
- Screenshot/evidence artifacts theo convention hiện có.

## Skills

`vibe-e2e`, `browser-testing-with-devtools`.

## Không làm

Không sửa product code trong pha E2E; tạo/follow task fix riêng nếu có lỗi.
