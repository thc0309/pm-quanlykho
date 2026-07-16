# T47: Báo giá và đơn bán nhiều dòng

## Mục tiêu

Cho sales create form nhập nhiều dòng, hiển thị tổng từng dòng và tổng chứng từ trước khi lưu.

## Hướng thực hiện

1. Chuyển product/quantity/unitPrice/tax thành row state có key ổn định; giữ customer/document metadata ngoài rows.
2. Add/remove với last-row guard; validate số hữu hạn, quantity dương, price/tax trong boundary backend.
3. Tính line total và grand total bằng cùng rounding rule contract hiện có; không dùng float format làm giá trị submit.
4. Submit đầy đủ `lines[]`; reset một dòng sau success, giữ input khi fail.
5. Test hai dòng, remove giữa, rounding boundary và exact payload/tổng hiển thị.

## Acceptance

- [ ] Quote/order hai dòng gửi đủ product, quantity, price, tax.
- [ ] Tổng dòng/chứng từ cập nhật khi input đổi và format tiền nhất quán.
- [ ] Không xóa dòng cuối; validation/error gắn đúng row.
- [ ] Không làm thay đổi approve/invoice workflow.

## Verification

- `npm test --prefix frontend -- --run SalesPage`
- `npm run build --prefix frontend`

## Dependencies

T30, T38.

## Likely Files

- `frontend/src/features/sales/SalesPage.tsx`
- `frontend/src/features/sales/SalesPage.test.tsx`
- `frontend/src/lib/api.ts` nếu type cần mở rộng.

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không thêm thư viện tiền tệ hoặc sửa pricing backend ngoài contract hiện có.
