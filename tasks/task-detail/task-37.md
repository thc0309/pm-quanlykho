# T37: Role permission matrix khi tạo role

## Mục tiêu

Thay danh sách checkbox phẳng bằng ma trận feature × action dùng trực tiếp catalog T34 khi tạo role.

## Hướng thực hiện

1. Expose catalog typed qua API access/admin hiện có hoặc import constant frontend nếu contract đã có; không duy trì hai danh sách thủ công.
2. Render row theo feature, column theo action; cell không áp dụng không có checkbox hoặc disabled có accessible explanation.
3. Cài `Chọn tất cả quyền` và `Chọn tất cả` từng dòng; trạng thái checked/indeterminate phản ánh selection thật.
4. Submit mảng code duy nhất, không duplicate và không cho rỗng; giữ lỗi backend là nguồn cuối.
5. Test chọn toàn bộ, chọn một dòng, bỏ một cell và submit payload.

## Acceptance

- [ ] Ma trận chỉ hiển thị permission hợp lệ từ catalog và usable bằng keyboard.
- [ ] Select-all toàn bảng/từng dòng cùng trạng thái indeterminate đúng.
- [ ] Không thể lưu role rỗng hoặc gửi code không áp dụng.
- [ ] Task này hoàn thiện create; edit chỉ hiển thị/reuse model và được nối API ở T45.

## Verification

- `npm test --prefix frontend -- --run AccessPage`
- `npm run build --prefix frontend`

## Dependencies

T34.

## Likely Files

- `frontend/src/features/admin/AccessPage.tsx`
- `frontend/src/features/admin/AccessPage.test.tsx`
- `frontend/src/lib/api.ts`

## Skills

`vibe-build`, `frontend-ui-engineering`, `test-driven-development`.

## Không làm

Không tạo generic data-grid/component library; ma trận chỉ phục vụ role permission.
