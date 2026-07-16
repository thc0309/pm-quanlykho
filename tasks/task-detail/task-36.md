# T36: Enforce permission chi tiết cho chứng từ, stock và báo cáo

## Mục tiêu

Thay permission ở toàn bộ document, inventory/stock, picking/checking, exception, report và print bằng catalog mới theo đúng action.

## Hướng thực hiện

1. Áp bảng mapping T34 cho từng route; tách list/detail `.view`, create `.create`, transition `.approve`, print `.print`, CSV `.export`.
2. `inventory` GET dùng `inventory.view`; stock movement/manual adjustment dùng action create/approve đã chốt trong catalog, không còn `stock.manage`.
3. Map pick/check/ship/exception vào feature/action mới; không giữ tên quyền runtime cũ.
4. Với route có nhiều transitions, permission phải nằm ngay trước mutation tương ứng, không đặt một quyền mặc định cho cả module.
5. Mở rộng test để chứng minh user có view không thể transition/export/print và denied call không đổi stock.

## Acceptance

- [ ] Không còn quyền cũ trong `backend/src`; mọi protected endpoint có permission mới rõ ràng.
- [ ] Pick/check/ship, adjustment và approve vẫn tách biệt, không gom thành một quyền rộng.
- [ ] Denied mutation trả 403 trước transaction/stock change.
- [ ] Full backend regression pass.

## Verification

- `npm test --prefix backend`
- `npm run build --prefix backend`
- `rtk rg -n '\.manage|outbound\.(pick|check|ship|resolveDiscrepancy)' backend/src` không có match permission cũ.

## Dependencies

T34.

## Likely Files

- `backend/src/modules/{receipts,outbound,purchasing,sales,returns,stock-counts,transfers,inventory,stock,picking,checking,outbound-exceptions,reports,print}.ts`
- Các backend test tương ứng.

## Skills

`vibe-build`, `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`, `test-driven-development`.

## Không làm

Không thay workflow/state machine hoặc payload chứng từ.
