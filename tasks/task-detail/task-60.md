# T60: Product API nhận và trả giá trị thông số

## Goal

Mở rộng product create/update/detail/list để lưu, validate và trả typed spec values theo category.

## Acceptance Criteria

- [ ] Product create/update nhận spec values và validate theo definitions active của category.
- [ ] Product create/update không yêu cầu spec values khi category không có required specs, để giữ workflow product cũ.
- [ ] Required thiếu, number sai min/max, select option inactive/sai category, boolean sai type đều trả `422`.
- [ ] Không cho ghi value cho definition không thuộc category của product.
- [ ] Product detail/edit trả cả value cũ của definition inactive để hiển thị lịch sử.

## Verification

- [ ] `npm test --prefix backend -- --test-name-pattern "product spec|product"`
- [ ] `npm run build --prefix backend`

## Dependencies

- T59

## Likely Files

- `backend/src/modules/products.ts`
- `backend/src/modules/catalog-specs.ts`
- `backend/test/products.test.ts`
- `backend/test/catalog-specs.test.ts`

## Recommended Skills

- `vibe-build`
- `api-and-interface-design`
- `security-and-hardening`
- `test-driven-development`
