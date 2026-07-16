# T50: Trả hàng nhiều dòng

## Mục tiêu

Cho return create form chọn nhiều movement/chứng từ gốc và quantity theo từng row, với thuật ngữ tiếng Việt đúng.

## Hướng thực hiện

1. Chuyển movementId/quantity thành row array; kind/document metadata giữ ngoài rows.
2. Mỗi row chọn movement hợp lệ theo return kind/document gốc; không cho quantity vượt mức backend cho phép.
3. Add/remove với last-row guard; đổi nhãn `Trả supplier` thành `Trả nhà cung cấp`.
4. Submit đủ `lines[]`, giữ form khi fail, reset một row khi success.
5. Test customer/supplier label, two-line payload, over-quantity error và last-row guard.

## Acceptance

- [ ] Return hai dòng gắn đúng movement và quantity.
- [ ] Không còn user-facing text `Trả supplier`.
- [ ] Invalid/over quantity không làm mất input hoặc submit partial rows.
- [ ] Không xóa dòng cuối.

## Verification

- `npm test --prefix frontend -- --run ReturnsPage`
- `npm run build --prefix frontend`
- Browser evidence hai dòng ở E2E-017 trong T52.

## Dependencies

T30, T38.

## Likely Files

- `frontend/src/features/returns/ReturnsPage.tsx`
- `frontend/src/features/returns/ReturnsPage.test.tsx`
- `frontend/src/lib/api.ts` nếu type cần mở rộng.

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không thay return confirmation/posting hoặc tự chọn movement bằng heuristic.
