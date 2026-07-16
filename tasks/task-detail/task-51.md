# T51: Chuyển kho và kiểm kê nhiều dòng

## Mục tiêu

Cho transfer chọn nhiều source balance/quantity và stock count chọn nhiều balance trong cùng create form.

## Hướng thực hiện

1. Transfer: state rows gồm stockBalanceId/quantity; filter balance theo source warehouse và ngăn chọn source/target giống nhau.
2. Stock count: dùng selection nhiều balance nhưng submit format backend `stockBalanceIds[]`; không tạo row model phức tạp nếu checkbox/list đủ dùng.
3. Với transfer, add/remove và last-row guard; validate duplicate balance/quantity vượt available ở UI, backend vẫn authoritative.
4. Submit toàn bộ rows/selections, giữ input khi fail và reset đúng sau success.
5. Test multi-line transfer, multi-select count, duplicate/over quantity và exact payload.

## Acceptance

- [ ] Transfer gửi nhiều source balance/quantity; stock count gửi nhiều IDs.
- [ ] Không xóa dòng transfer cuối; stock count không submit selection rỗng.
- [ ] Duplicate/invalid balance bị chặn và lỗi đúng item.
- [ ] Dispatch/receive/approve workflow không đổi.

## Verification

- `npm test --prefix frontend -- --run TransfersPage StockCountsPage`
- `npm run build --prefix frontend`

## Dependencies

T30, T38.

## Likely Files

- `frontend/src/features/transfers/TransfersPage.tsx`
- `frontend/src/features/stock-counts/StockCountsPage.tsx`
- Các test tương ứng.

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không sửa transfer receive lines, count actual workflow hoặc backend schema.
