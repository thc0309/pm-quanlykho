# T30: Chuẩn hóa label bắt buộc cho form chứng từ

## Mục tiêu

Áp dụng rule `(*)` và tiếng Việt cho toàn bộ create form chứng từ hiện có mà không thay đổi payload nghiệp vụ.

## Điểm bắt đầu trong code

Các form nằm tại `purchasing`, `receipts`, `outbound`, `sales`, `returns`, `transfers`, `stock-counts`; backend Zod schema là nguồn đối chiếu required/conditional required.

## Hướng thực hiện

1. Đối chiếu từng input với schema route và ghi lại field bắt buộc, optional, conditional.
2. Sửa label và `required`; giữ `SKU`, `barcode`, `ID`, `FEFO` khi dịch làm giảm rõ nghĩa.
3. Với field conditional lot/serial/expiry, chỉ hiển thị marker khi điều kiện trên đúng dòng đang có hiệu lực.
4. Cập nhật test theo accessible name mới, không chụp snapshot toàn page.

## Acceptance

- [ ] Tất cả field required trong bảy nhóm form có `(*)`, optional không có.
- [ ] Label và validation user-facing là tiếng Việt đúng phạm vi.
- [ ] Không thay đổi request payload hoặc workflow chứng từ.

## Verification

- `npm test --prefix frontend -- --run PurchasingPage ReceiptPage OutboundPage SalesPage ReturnsPage TransfersPage StockCountsPage`
- `npm run build --prefix frontend`

## Dependencies

T29 để dùng cùng convention.

## Likely Files

- `frontend/src/features/{purchasing,receipts,outbound,sales,returns,transfers,stock-counts}/*Page.tsx`
- Các test page tương ứng.

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không chuyển form sang nhiều dòng; phần đó thuộc T46-T51.
