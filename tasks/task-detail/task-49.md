# T49: Phiếu xuất nhiều dòng

## Mục tiêu

Cho outbound create form gửi nhiều product/quantity trong một document và reset đúng sau thành công.

## Hướng thực hiện

1. Chuyển product/quantity thành row array có key ổn định, một row mặc định.
2. Add/remove với last-row guard; validate product và quantity dương từng row.
3. Submit toàn bộ `lines[]`, không phụ thuộc row đang focus; giữ form khi fail.
4. Sau 201 reset document number/rows theo behavior hiện tại và đúng một row trống.
5. Test exact payload hai dòng, remove, validation và reset success/failure.

## Acceptance

- [ ] Outbound hai dòng được gửi đủ và UI không mất row khi API fail.
- [ ] Không xóa dòng cuối; error đúng row.
- [ ] Success reset về một row trống, không giữ key/value cũ.
- [ ] Release/picking workflow không đổi.

## Verification

- `npm test --prefix frontend -- --run OutboundPage`
- `npm run build --prefix frontend`

## Dependencies

T30, T38.

## Likely Files

- `frontend/src/features/outbound/OutboundPage.tsx`
- `frontend/src/features/outbound/OutboundPage.test.tsx`
- `frontend/src/lib/api.ts` nếu type cần mở rộng.

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không gộp dòng trùng, reserve/release tự động hoặc sửa picking flow.
