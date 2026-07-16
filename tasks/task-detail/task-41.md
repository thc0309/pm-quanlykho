# T41: API update/status an toàn cho product

## Mục tiêu

Cho sửa metadata product an toàn và activate/deactivate mà không phá tracking, barcode hoặc lịch sử tồn kho.

## Hướng thực hiện

1. Schema chỉ nhận name, barcodes, categoryId, baseUnitId, expiryManaged, fefoEnabled và status theo route tương ứng.
2. SKU/trackingMode bất biến; validate category/unit cùng warehouse và barcode unique trong warehouse.
3. Khi product đã có tồn/chứng từ/lot/serial/movement, chặn thay đổi có thể làm sai lịch sử; tối thiểu tracking/SKU luôn bị loại khỏi schema.
4. Update product và barcode set trong một transaction; tránh trạng thái product đã đổi nhưng barcode thất bại.
5. Audit update/status và expose client methods.

## Acceptance

- [ ] Duplicate barcode hoặc reference ngoài warehouse bị reject.
- [ ] SKU/tracking mode không thể sửa qua payload thừa.
- [ ] Update barcode là atomic; conflict không để dữ liệu dở dang.
- [ ] Deactivate/update nguy hiểm bị chặn, mutation hợp lệ có audit.

## Verification

- `npm test --prefix backend -- --test-name-pattern product`
- `npm run build --prefix backend`

## Dependencies

T35, T39.

## Likely Files

- `backend/src/modules/products.ts`
- `backend/test/products.test.ts`
- `frontend/src/lib/api.ts`

## Skills

`vibe-build`, `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`, `test-driven-development`.

## Không làm

Không đổi SKU/tracking mode, hard delete hoặc rewrite stock history.
