# T48: Phiếu nhập nhiều dòng với tracking theo dòng

## Mục tiêu

Cho create receipt nhập nhiều sản phẩm/location và field lot/serial/expiry theo đúng tracking mode của từng row.

## Hướng thực hiện

1. Đổi form thành `lines[]` với key ổn định và một row trống mặc định.
2. Khi product của row đổi, lấy tracking mode row đó và reset field conditional không còn áp dụng để tránh payload stale.
3. Render/mark required lot, serial, expiry đúng row; quantity/serial constraints khớp backend.
4. Add/remove với last-row guard; submit mọi row, giữ error theo index/client key.
5. Test kết hợp row none + lot + serial, đổi product giữa chừng và exact payload.

## Acceptance

- [ ] Mỗi row giữ product/location/quantity và tracking fields độc lập.
- [ ] Conditional required marker/validation đổi đúng khi product thay đổi.
- [ ] Payload không chứa field tracking stale hoặc bỏ sót row.
- [ ] Không xóa dòng cuối; success reset một row sạch.

## Verification

- `npm test --prefix frontend -- --run ReceiptPage`
- `npm run build --prefix frontend`

## Dependencies

T30, T38.

## Likely Files

- `frontend/src/features/receipts/ReceiptPage.tsx`
- `frontend/src/features/receipts/ReceiptPage.test.tsx`
- `frontend/src/lib/api.ts` nếu type cần mở rộng.

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không thay receipt confirmation, stock posting hoặc tracking schema backend.
