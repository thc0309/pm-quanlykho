# T38: Permission-based route và navigation

## Mục tiêu

Frontend dùng permission mới cho access state, protected route và menu; action-specific UI được các task domain nối tiếp.

## Hướng thực hiện

1. Cập nhật response/type của `/api/access/me` và helper kiểm tra permission để hiểu `*` và exact code; không hỗ trợ alias cũ.
2. Map từng route/menu vào `<feature>.view`; route bị từ chối phải redirect/hiển thị forbidden theo pattern hiện có.
3. Xóa các biến nguồn kiểu `canCatalog = catalog.manage`; chỉ giữ helper nhỏ nếu có ít nhất nhiều consumers thật.
4. Cập nhật test nav/route cho user chỉ có một quyền view và master admin.
5. Ghi contract để T43-T51 dùng cùng helper cho create/update/delete/approve/print/export.

## Acceptance

- [ ] Menu và route phản ánh `.view`; direct navigation không mở page trái quyền.
- [ ] Master admin `*` vẫn thấy toàn bộ scope hợp lệ.
- [ ] Frontend không còn permission cũ.
- [ ] Action buttons chưa thuộc task domain không bị đổi nửa vời.

## Verification

- `npm test --prefix frontend`
- `npm run build --prefix frontend`
- `rtk rg -n '\.manage|outbound\.(pick|check|ship|resolveDiscrepancy)' frontend/src` không còn permission runtime cũ.

## Dependencies

T35, T36, T37.

## Likely Files

- `frontend/src/App.tsx`
- `frontend/src/layout/AppSidebar.tsx`
- `frontend/src/lib/api.ts`
- Tests route/sidebar/access.

## Skills

`vibe-build`, `frontend-ui-engineering`, `security-and-hardening`, `test-driven-development`.

## Không làm

Không sửa hàng loạt mọi `features/**`; action gating nằm trong T43-T51.
