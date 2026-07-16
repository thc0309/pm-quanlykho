# T53: Review và cleanup trước merge

## Mục tiêu

Review toàn bộ diff T29-T52, sửa findings được chấp nhận, đơn giản hóa và đưa ra trạng thái sẵn sàng merge có bằng chứng.

## Hướng thực hiện

1. Xác định exact diff từ base trước T29; review test trước rồi implementation theo correctness, security, readability, architecture và performance.
2. Kiểm đặc biệt upload boundary/lifecycle, permission mapping mọi endpoint, migration order/reset note, transaction metadata và multi-line payload.
3. Chạy `vibe-simplify` trên code vừa đổi: xóa duplication thật nhưng không tạo abstraction speculative.
4. Address mọi high/medium finding hoặc ghi blocker/decision rõ; không trộn cleanup ngoài scope.
5. Chạy full lint/build/test và đối chiếu E2E evidence; cập nhật review result, task status và memory.

## Acceptance

- [ ] Không còn high/medium finding chưa xử lý hoặc chưa được human chấp nhận defer.
- [ ] Không còn permission runtime cũ, migration trùng version hoặc upload path không bounded.
- [ ] Full lint/build/test pass; E2E-015..019 có evidence hoặc blocker rõ.
- [ ] Diff cuối không chứa abstraction/dependency không cần thiết và worktree scope được giải thích.

## Verification

- `npm run lint`
- `npm run build`
- `npm test`
- `$vibe-review`
- `$vibe-simplify`

## Dependencies

T52.

## Likely Files

- Mọi file đổi bởi T29-T52.
- `tasks/test-result.md`, `tasks/todo.md`, memory files.

## Skills

`vibe-review`, `code-review-and-quality`, `security-and-hardening`, `performance-optimization`, `vibe-simplify`.

## Không làm

Không thêm feature mới hoặc commit nếu user chưa yêu cầu.
