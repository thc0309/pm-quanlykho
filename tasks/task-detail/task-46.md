# T46: Đơn mua nhiều dòng

## Mục tiêu

Cho create purchase order nhập và submit nhiều dòng sản phẩm trong một request `lines[]`.

## Điểm bắt đầu trong code

Backend `purchasing.ts` đã nhận `lines[]`; chỉ sửa `PurchaseCreatePage` và test/API type nếu type frontend đang giới hạn một dòng.

## Hướng thực hiện

1. Đổi state một dòng thành mảng row có client key ổn định; khởi tạo đúng một dòng trống.
2. `Thêm dòng` append; `Xóa dòng` xóa đúng row và disabled khi chỉ còn một dòng.
3. Validate supplier và từng row product/quantity; label theo T30.
4. Submit toàn bộ rows sau normalize number; giữ row/error khi API fail, reset một row khi thành công.
5. Test add/remove/last-row guard và exact payload hai dòng.

## Acceptance

- [ ] Tạo PO hai dòng persist đủ hai dòng; không chỉ dòng đang focus.
- [ ] Không xóa được dòng cuối và lỗi gắn đúng row.
- [ ] `Nhà cung cấp (*)` và field row required đúng accessible label.
- [ ] Không thêm dependency form/table.

## Verification

- `npm test --prefix frontend -- --run PurchasingPage`
- `npm run build --prefix frontend`
- Browser evidence ở E2E-017 trong T52.

## Dependencies

T30, T38.

## Likely Files

- `frontend/src/features/purchasing/PurchasingPage.tsx`
- `frontend/src/features/purchasing/PurchasingPage.test.tsx`
- `frontend/src/lib/api.ts` nếu type cần mở rộng.

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không edit PO draft, merge dòng trùng hoặc đổi backend schema.
