# Implementation Plan: Hoàn thiện form, user metadata và phân quyền v4

Status: đang thực hiện v4.1 — đã được xác nhận build toàn bộ

## Overview

Plan v4 gom các scope mới từ `SPEC.md`: trường bắt buộc có `(*)`, user metadata có avatar upload/resize và số điện thoại bắt buộc, phân quyền chi tiết theo ma trận tính năng x hành động, metadata CRUD/vô hiệu hóa dùng được, và form chứng từ nhiều dòng. Thứ tự ưu tiên: chuẩn hóa UI rule nhỏ trước, sau đó làm nền user/permission vì nó ảnh hưởng mọi API action, rồi mới nối metadata và form nhiều dòng.

## Architecture Decisions

- Reset/reseed dữ liệu development khi chạy migration user metadata; `phone` là `NOT NULL`, không backfill số ngẫu nhiên.
- Tách migration `018_user_metadata.sql` và `019_granular_permissions.sql`; migration đã chạy không bị sửa lại.
- Avatar được xác thực theo nội dung, crop 256x256, bỏ metadata và lưu WebP tối đa 200 KB; file đầu vào tối đa 5 MB.
- Thay toàn bộ permission cũ bằng `<feature>.<action>`; không giữ compatibility runtime vì dự án chưa production.
- Hard delete role chỉ khi chưa từng gán user; role đã/đang tham chiếu bị chặn.
- Chi tiết thực thi từng task nằm trong `tasks/task-detail/task-29.md` đến `task-53.md`.

## Dependency Order

```text
Required label rule
  └─> User metadata DB/API/avatar
      └─> Granular permission catalog + role matrix
          └─> Granular backend enforcement
              ├─> Metadata API/client
              │   └─> Metadata UI actions
              └─> Multi-line document forms
                  └─> E2E + review
```

## Skill Intake Summary

### Stack và work domain

- Frontend: React/Vite/TypeScript/Tailwind, route/component theo `frontend/src/features`.
- Backend: Hono + TypeScript + Zod + PostgreSQL SQL trực tiếp, migration versioned, auth cookie session.
- Domains: form UX/accessibility, upload/resize ảnh, user profile metadata, RBAC chi tiết, API permission enforcement, metadata CRUD, chứng từ nhiều dòng, browser E2E.

### Applicable existing skills

| Nhóm việc | Skills nên dùng |
|---|---|
| Plan/spec/task | `vibe-plan`, `planning-and-task-breakdown`, `spec-driven-development` |
| Build từng task | `vibe-build`, `incremental-implementation`, `test-driven-development` |
| UI form/role matrix | `frontend-ui-engineering`, `vibe-test` |
| API contract/permission | `api-and-interface-design`, `security-and-hardening` |
| Upload/avatar validation | `security-and-hardening`, `source-driven-development` |
| Data migration/audit | `doubt-driven-development`, `test-driven-development` |
| Debug | `debugging-and-error-recovery` |
| Browser evidence | `vibe-e2e`, `browser-testing-with-devtools` |
| Review/simplify | `vibe-review`, `code-review-and-quality`, `vibe-simplify` |

### Missing useful skill gaps

- Có thể cần thư viện resize ảnh server-side hoặc browser-side. Không thêm dependency trong plan; task build phải kiểm tra dependency hiện có trước. Nếu không có giải pháp chuẩn nhỏ gọn, hỏi trước khi thêm dependency.
- Nếu role matrix lặp nhiều logic selection, cân nhắc tạo helper/component nhỏ sau 2 use case thật; không tạo component library sớm.

## Task Plan

Mỗi task có hướng thực hiện chi tiết, ranh giới và bằng chứng tại `tasks/task-detail/`. `tasks/todo.md` là index có liên kết trực tiếp; khi build chỉ đọc task đang active và các dependency được trích dẫn.

### Phase 1 — Rule nền và nhãn bắt buộc

#### T29: Chuẩn hóa label bắt buộc cho form lõi

**Description:** Áp dụng `(*)` cho form auth, user/role, metadata nhỏ.

**Acceptance criteria:**
- [x] Field bắt buộc trong auth, admin user/role, category/unit, location, product, partner có `(*)`.
- [x] Field optional không có `(*)`.
- [x] Accessible label vẫn tìm được bằng tiếng Việt.

**Verification:**
- [x] `npm test --prefix frontend -- --run AccessPage CatalogPage LocationsPage ProductsPage PartnersPage AuthPage` — 6 file, 20 test pass.
- [x] `npm run build --prefix frontend` — TypeScript và Vite build pass.

**Dependencies:** None

**Likely files:**
- `frontend/src/features/auth/AuthPage.tsx`
- `frontend/src/features/admin/AccessPage.tsx`
- `frontend/src/features/catalog/CatalogPage.tsx`
- `frontend/src/features/locations/LocationsPage.tsx`
- `frontend/src/features/products/ProductsPage.tsx`
- `frontend/src/features/partners/PartnersPage.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T30: Chuẩn hóa label bắt buộc cho form chứng từ

**Description:** Áp dụng `(*)` và tiếng Việt cho form đơn mua, nhập, xuất, bán, trả hàng, chuyển kho, kiểm kê.

**Acceptance criteria:**
- [x] Tất cả field required trong form chứng từ có `(*)`.
- [x] Label user-facing dùng tiếng Việt; giữ `SKU`, `barcode`, `ID` khi là thuật ngữ kỹ thuật.
- [x] Test cập nhật theo label mới.

**Verification:**
- [x] `npm test --prefix frontend -- --run PurchasingPage ReceiptPage OutboundPage SalesPage ReturnsPage TransfersPage StockCountsPage` — 7 file, 14 test pass.
- [x] `npm run build --prefix frontend` — TypeScript và Vite build pass.

**Dependencies:** T29

**Likely files:**
- `frontend/src/features/purchasing/PurchasingPage.tsx`
- `frontend/src/features/receipts/ReceiptPage.tsx`
- `frontend/src/features/outbound/OutboundPage.tsx`
- `frontend/src/features/sales/SalesPage.tsx`
- `frontend/src/features/returns/ReturnsPage.tsx`
- `frontend/src/features/transfers/TransfersPage.tsx`
- `frontend/src/features/stock-counts/StockCountsPage.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

### Checkpoint A — Required labels

- [x] T29-T30 pass.
- [x] Không còn form chính thiếu `(*)`.
- [x] Rà soát thủ công tiếng Việt/thuật ngữ; giữ `PO`, `SKU`, `ID`, `barcode` khi phù hợp.

### Phase 2 — User metadata và avatar

#### T31: Migration và API user metadata

**Description:** Thêm metadata user vào DB/API, bắt buộc `phone`.

**Acceptance criteria:**
- [x] Migration thêm `phone`, `avatar_url`, `employee_code`, `job_title`, `department`, `note`.
- [x] Reset/reseed dữ liệu dev; `phone` là `NOT NULL`; seed master/warehouse admin có số điện thoại cấu hình rõ ràng.
- [x] Create/update user nhận và validate metadata; `email`, `fullName`, `phone` bắt buộc.
- [x] List users trả metadata mới, warehouse scope và audit giữ nguyên.

**Verification:**
- [x] `npm test --prefix backend -- --test-name-pattern admin` — 66 test pass, gồm create/update/scope/audit metadata.
- [x] `npm run build --prefix backend` — TypeScript pass.
- [x] `npm run db:migrate --prefix backend` — reset DB dev, migration 001–018 pass; seed master/warehouse admin pass.
- [x] `npm test --prefix frontend -- --run AccessPage` và frontend build pass; form hiện hữu thêm phone tối thiểu để giữ contract.
- [x] `npm audit --prefix backend --audit-level=high` — 0 lỗ hổng.

**Dependencies:** None

**Likely files:**
- `backend/db/migrations/018_user_metadata.sql`
- `backend/src/modules/admin.ts`
- `backend/src/db/seed.ts`
- `backend/test/admin.test.ts`
- `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `test-driven-development`

#### T32: Avatar upload và resize

**Description:** Thêm đường upload avatar an toàn, resize ảnh trước khi lưu, DB chỉ lưu URL/key.

**Acceptance criteria:**
- [x] Chỉ nhận file hình hợp lệ, giới hạn size/type.
- [x] Kiểm tra magic bytes; crop 256x256, bỏ metadata, lưu WebP không quá 200 KB từ file đầu vào không quá 5 MB.
- [x] API trả `avatarUrl`, không lưu binary trong DB.
- [x] Upload/update kiểm tra permission và warehouse scope, audit thành công, dọn file cũ; lỗi trả tiếng Việt.

**Verification:**
- [x] `npm test --prefix backend -- --test-name-pattern avatar` — 69 test pass; decoder xác nhận WebP 256×256, bỏ EXIF/XMP và ≤200 KB.
- [x] `npm run build --prefix backend` — TypeScript pass.
- [x] `npm audit --prefix backend --audit-level=high` — 0 lỗ hổng.
- [x] Đối chiếu docs chính thức: Hono body limit/file upload và Sharp 0.35 constructor/resize/output.

**Dependencies:** T31

**Likely files:**
- `backend/src/modules/admin.ts`
- `backend/src/modules/avatar.ts` hoặc helper gần admin nếu cần
- `backend/test/admin.test.ts`
- `backend/uploads/` hoặc cấu hình static upload nếu được chọn

**Recommended skills:** `vibe-build`, `security-and-hardening`, `source-driven-development`, `test-driven-development`

#### T33: UI user metadata

**Description:** User list/create/edit hiển thị và lưu avatar, phone, employeeCode, jobTitle, department, note.

**Acceptance criteria:**
- [x] Form user có `phone (*)`; metadata khác optional.
- [x] Upload avatar preview được trước/sau lưu.
- [x] User list hiển thị avatar, họ tên, email, phone, bộ phận/chức danh, trạng thái.
- [x] Không hard delete user.

**Verification:**
- [x] `npm test --prefix frontend -- --run AccessPage` — 9/9 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T31, T32

**Likely files:**
- `frontend/src/features/admin/AccessPage.tsx`
- `frontend/src/features/admin/AccessPage.test.tsx`
- `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `security-and-hardening`, `test-driven-development`

### Checkpoint B — User metadata

- [x] T31-T33 pass.
- [x] Avatar upload không lưu binary trong DB.
- [x] Phone required được enforce ở UI và backend.

### Phase 3 — Granular permission model

#### T34: Permission catalog và migration reset

**Description:** Định nghĩa permission `<feature>.<action>`, reset/reseed toàn bộ role development và loại bỏ permission cũ khỏi runtime.

**Acceptance criteria:**
- [x] Permission list có các feature/action tối thiểu trong `SPEC.md` và ma trận route hiện tại.
- [x] Permission cũ không còn trong catalog/seed; route enforcement được chuyển theo T35-T36 đúng task detail.
- [x] Reset/reseed role development tạo warehouse admin với toàn bộ quyền chi tiết phù hợp.
- [x] Master admin vẫn nhận `*`.
- [x] Role rỗng, code lạ hoặc code trùng đều bị từ chối.

**Verification:**
- [x] `npm test --prefix backend -- --test-name-pattern admin` — 72/72 test pass.
- [x] `npm run build --prefix backend`
- [x] `npm run db:migrate --prefix backend` — đã áp dụng `019_granular_permissions.sql`.

**Dependencies:** T31

**Likely files:**
- `backend/db/migrations/019_granular_permissions.sql`
- `backend/src/modules/admin.ts`
- `backend/src/modules/access.ts`
- `backend/src/db/seed.ts`
- `backend/test/admin.test.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`

#### T35: Backend enforce quyền chi tiết cho admin và metadata

**Description:** Thay checks tổng quát bằng quyền action cụ thể cho users, roles, locations, catalog, products, partners.

**Acceptance criteria:**
- [x] `view/create/update/delete` được kiểm tra theo endpoint/action.
- [x] User có `view` nhưng thiếu `create/update/delete` bị 403 khi gọi API tương ứng.
- [x] UI hiding không phải lớp bảo mật duy nhất; backend test cover trực tiếp và xác nhận không ghi audit giả.

**Verification:**
- [x] `npm test --prefix backend -- --test-name-pattern "access|admin|catalog|location|product|partner"` — 75/75 test pass.
- [x] `npm run build --prefix backend`

**Dependencies:** T34

**Likely files:**
- `backend/src/modules/access.ts`
- `backend/src/modules/admin.ts`
- `backend/src/modules/catalog.ts`
- `backend/src/modules/locations.ts`
- `backend/src/modules/products.ts`
- `backend/src/modules/partners.ts`
- related backend tests

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`

#### T36: Backend enforce quyền chi tiết cho chứng từ, báo cáo và in

**Description:** Áp dụng permission action cho receipt/outbound/purchase/sales/returns/stock-count/transfer/report/print.

**Acceptance criteria:**
- [x] View/create/approve/print/export tách đúng endpoint.
- [x] Inventory và stock routes dùng `inventory.view/create` phù hợp; không còn `stock.manage`.
- [x] Pick/check/ship và exception dùng catalog `<feature>.<action>` mới, không giữ tên quyền cũ.

**Verification:**
- [x] `npm test --prefix backend` — 77/77 test pass.
- [x] `npm run build --prefix backend`

**Dependencies:** T34

**Likely files:**
- `backend/src/modules/receipts.ts`
- `backend/src/modules/outbound.ts`
- `backend/src/modules/purchasing.ts`
- `backend/src/modules/sales.ts`
- `backend/src/modules/returns.ts`
- `backend/src/modules/stock-counts.ts`
- `backend/src/modules/transfers.ts`
- `backend/src/modules/inventory.ts`
- `backend/src/modules/stock.ts`
- `backend/src/modules/reports.ts`
- `backend/src/modules/print.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`

#### T37: Role permission matrix UI

**Description:** Thay checkbox phẳng bằng bảng quyền feature x action, có chọn tất cả toàn role và từng dòng.

**Acceptance criteria:**
- [x] Role create hiển thị ma trận quyền từ API catalog; dữ liệu edit reuse cùng model và chỉ nối API ở T45.
- [x] `Chọn tất cả quyền` bật/tắt toàn bộ checkbox hợp lệ.
- [x] `Chọn tất cả` từng dòng bật/tắt quyền của một feature.
- [x] Cell action không áp dụng không render checkbox.
- [x] Không lưu role rỗng; payload chỉ gồm code hợp lệ, duy nhất.

**Verification:**
- [x] `npm test --prefix frontend -- --run AccessPage` — 11/11 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T34

**Likely files:**
- `frontend/src/features/admin/AccessPage.tsx`
- `frontend/src/features/admin/AccessPage.test.tsx`
- `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T38: Permission-based navigation/action UI

**Description:** Frontend access state, route và navigation dùng permission chi tiết; action theo domain được nối trong T43-T51.

**Acceptance criteria:**
- [x] Menu hiển thị theo `.view`.
- [x] Shared permission lookup hỗ trợ exact action và wildcard; route/menu dùng `.view` và không còn `*.manage`.
- [x] T43-T51 có thể dùng chung `hasPermission` để gate action theo domain.
- [x] Không còn logic nguồn quyền tổng quát kiểu `canCatalog`.

**Verification:**
- [x] `npm test --prefix frontend` — 53/53 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T35, T36, T37

**Likely files:**
- `frontend/src/App.tsx`
- `frontend/src/layout/AppSidebar.tsx`
- `frontend/src/features/**`
- `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `security-and-hardening`, `test-driven-development`

### Checkpoint C — Granular permissions

- [x] T34-T38 pass.
- [x] Role matrix usable.
- [x] User with partial permission is blocked by API, not only UI.

### Phase 4 — Metadata API và client

#### T39: Update/status cho danh mục và đơn vị

**Description:** Backend hỗ trợ sửa tên và vô hiệu hóa/kích hoạt category/unit.

**Acceptance criteria:**
- [x] Category/unit update/status scoped theo kho.
- [x] Delete action có semantics `Vô hiệu hóa`; không hard delete.
- [x] 403/404/409/422 có test.
- [x] Audit update/status cho category và unit.

**Verification:**
- [x] `npm test --prefix backend -- --test-name-pattern catalog` — 80/80 test pass.
- [x] `npm run build --prefix backend`

**Dependencies:** T35

**Likely files:** `backend/src/modules/catalog.ts`, `backend/test/catalog.test.ts`, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `test-driven-development`

#### T40: Update/status cho vị trí kho

**Description:** Sửa tên/barcode/loại location và vô hiệu hóa an toàn.

**Acceptance criteria:**
- [x] Duplicate code/barcode bị reject.
- [x] Không vô hiệu hóa location còn tồn hoặc đang được chứng từ/picking/checking tham chiếu.
- [x] Audit update/status.

**Verification:**
- [x] `npm test --prefix backend -- --test-name-pattern location` — 82/82 test pass.
- [x] `npm run build --prefix backend`
- [x] `npm run build --prefix frontend`

**Dependencies:** T35

**Likely files:** `backend/src/modules/locations.ts`, `backend/test/locations.test.ts`, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`

#### T41: Update/status cho sản phẩm

**Description:** Sửa thông tin an toàn và vô hiệu hóa product.

**Acceptance criteria:**
- [x] Sửa name/barcodes/category/baseUnit/FEFO/expiry trong phạm vi an toàn.
- [x] Duplicate barcode bị reject.
- [x] Không sửa SKU/tracking mode trong task này.
- [x] Audit update/status và chặn thay đổi nguy hiểm khi sản phẩm đã có tồn/chứng từ.

**Verification:**
- [x] `npm test --prefix backend -- --test-name-pattern product` — 84/84 test pass.
- [x] `npm run build --prefix backend`
- [x] `npm run build --prefix frontend`

**Dependencies:** T35, T39

**Likely files:** `backend/src/modules/products.ts`, `backend/test/products.test.ts`, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`

#### T42: Update/delete an toàn cho role

**Description:** Role backend hỗ trợ sửa tên/quyền và xóa role chưa gán user.

**Acceptance criteria:**
- [ ] Update role không cho permission rỗng.
- [ ] Delete role bị chặn khi đang gán user.
- [ ] Audit update/delete.

**Verification:**
- [ ] `npm test --prefix backend -- --test-name-pattern admin`
- [ ] `npm run build --prefix backend`

**Dependencies:** T34

**Likely files:** `backend/src/modules/admin.ts`, `backend/test/admin.test.ts`, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `test-driven-development`

### Checkpoint D — Metadata APIs

- [ ] T39-T42 pass.
- [ ] API client expose update/status/delete methods.
- [ ] Hard delete boundaries reviewed.

### Phase 5 — Metadata UI actions

#### T43: UI danh mục và đơn vị

**Description:** Nối sửa/vô hiệu hóa category/unit, không còn nút disabled.

**Acceptance criteria:**
- [ ] Edit/status cập nhật row không reload.
- [ ] Lỗi permission/constraint tiếng Việt.
- [ ] Không dùng chữ `Xóa` cho dữ liệu nghiệp vụ.

**Verification:** `npm test --prefix frontend -- --run CatalogPage` và `npm run build --prefix frontend`

**Dependencies:** T39, T38

**Likely files:** `frontend/src/features/catalog/CatalogPage.tsx`, `frontend/src/features/catalog/CatalogPage.test.tsx`, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T44: UI vị trí và sản phẩm

**Description:** Nối sửa/vô hiệu hóa location/product.

**Acceptance criteria:**
- [ ] Location edit/status hoạt động.
- [ ] Product edit/status hoạt động.
- [ ] Action button hiện theo permission chi tiết.

**Verification:** `npm test --prefix frontend -- --run LocationsPage ProductsPage` và `npm run build --prefix frontend`

**Dependencies:** T40, T41, T38

**Likely files:** `frontend/src/features/locations/LocationsPage.tsx`, `frontend/src/features/products/ProductsPage.tsx`, related tests

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T45: UI đối tác và role

**Description:** Nối sửa/vô hiệu hóa partner và sửa/xóa role.

**Acceptance criteria:**
- [ ] Partner update/status dùng API hiện có và permission chi tiết.
- [ ] Role update/delete dùng API mới.
- [ ] Delete role đang gán user hiển thị lỗi rõ ràng.

**Verification:** `npm test --prefix frontend -- --run PartnersPage AccessPage` và `npm run build --prefix frontend`

**Dependencies:** T37, T38, T42

**Likely files:** `frontend/src/features/partners/PartnersPage.tsx`, `frontend/src/features/admin/AccessPage.tsx`, related tests

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

### Checkpoint E — Metadata UX

- [ ] T43-T45 pass.
- [ ] Không còn nút metadata disabled vì chưa hỗ trợ.
- [ ] Browser smoke cho category, product, partner, role.

### Phase 6 — Multi-line document forms

#### T46: Đơn mua nhiều dòng

**Description:** PO create form nhập nhiều sản phẩm trong một đơn mua.

**Acceptance criteria:** `Thêm dòng`, `Xóa dòng`, không xóa dòng cuối, submit nhiều `lines[]`, label `Nhà cung cấp (*)`.

**Verification:** `npm test --prefix frontend -- --run PurchasingPage` và `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/purchasing/PurchasingPage.tsx`, `frontend/src/features/purchasing/PurchasingPage.test.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T47: Báo giá và đơn bán nhiều dòng

**Description:** Sales create form nhiều dòng, có tổng tiền dòng và tổng chứng từ.

**Acceptance criteria:** thêm/xóa nhiều dòng, submit nhiều line, tổng tiền hiển thị trước khi lưu.

**Verification:** `npm test --prefix frontend -- --run SalesPage` và `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/sales/SalesPage.tsx`, `frontend/src/features/sales/SalesPage.test.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T48: Phiếu nhập nhiều dòng với tracking theo từng dòng

**Description:** Receipt create form nhiều dòng, field lot/serial/expiry theo product từng dòng.

**Acceptance criteria:** mỗi dòng có product/location/quantity, conditional required đúng dòng, submit đúng payload.

**Verification:** `npm test --prefix frontend -- --run ReceiptPage` và `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/receipts/ReceiptPage.tsx`, `frontend/src/features/receipts/ReceiptPage.test.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T49: Phiếu xuất nhiều dòng

**Description:** Outbound create form nhiều dòng product/quantity.

**Acceptance criteria:** thêm/xóa dòng, submit nhiều `lines[]`, reset về một dòng trống sau khi tạo.

**Verification:** `npm test --prefix frontend -- --run OutboundPage` và `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/outbound/OutboundPage.tsx`, `frontend/src/features/outbound/OutboundPage.test.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T50: Trả hàng nhiều dòng

**Description:** Return create form nhiều dòng movement/quantity, sửa nhãn `Trả nhà cung cấp`.

**Acceptance criteria:** thêm/xóa nhiều dòng, submit nhiều `lines[]`, không còn `Trả supplier`.

**Verification:** `npm test --prefix frontend -- --run ReturnsPage` và `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/returns/ReturnsPage.tsx`, `frontend/src/features/returns/ReturnsPage.test.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T51: Chuyển kho và kiểm kê nhiều dòng

**Description:** Transfer create và stock count create hỗ trợ nhiều dòng/tồn trong cùng chứng từ.

**Acceptance criteria:** transfer gửi nhiều source balance/quantity; stock count chọn nhiều balance; không xóa dòng cuối.

**Verification:** `npm test --prefix frontend -- --run TransfersPage StockCountsPage` và `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/transfers/TransfersPage.tsx`, `frontend/src/features/stock-counts/StockCountsPage.tsx`, related tests

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

### Checkpoint F — Multi-line forms

- [ ] T46-T51 pass.
- [ ] Browser smoke tạo đơn mua hai dòng và trả hàng hai dòng.
- [ ] Human review xem có cần form sửa chứng từ nháp ở phase sau không.

### Phase 7 — E2E và review

#### T52: Browser E2E cho rule mới

**Description:** Chạy E2E-015 đến E2E-019 và ghi evidence.

**Acceptance criteria:**
- [ ] E2E-015 required markers pass.
- [ ] E2E-016 metadata actions pass.
- [ ] E2E-017 multi-line documents pass.
- [ ] E2E-018 user metadata/avatar pass.
- [ ] E2E-019 granular permissions pass.

**Verification:**
- [ ] `$vibe-e2e E2E-015`
- [ ] `$vibe-e2e E2E-016`
- [ ] `$vibe-e2e E2E-017`
- [ ] `$vibe-e2e E2E-018`
- [ ] `$vibe-e2e E2E-019`

**Dependencies:** T33, T43-T51

**Likely files:** `tasks/test-result.md`

**Recommended skills:** `vibe-e2e`, `browser-testing-with-devtools`

#### T53: Review và cleanup trước merge

**Description:** Review toàn bộ diff, đơn giản hóa lặp thừa, chạy regression rộng.

**Acceptance criteria:**
- [ ] Full lint/build/test pass hoặc blocker ghi rõ.
- [ ] Review không còn high/medium finding chưa xử lý.
- [ ] Không còn permission cũ `*.manage` làm source chính cho code mới.

**Verification:**
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] `$vibe-review`

**Dependencies:** T52

**Likely files:** all files changed by T29-T52

**Recommended skills:** `vibe-review`, `code-review-and-quality`, `vibe-simplify`

## Phase Checkpoints

1. **Checkpoint A after T30:** required marker and Vietnamese label baseline.
2. **Checkpoint B after T33:** user metadata and avatar upload.
3. **Checkpoint C after T38:** granular permission model and UI matrix.
4. **Checkpoint D after T42:** metadata APIs ready.
5. **Checkpoint E after T45:** metadata UI actions usable.
6. **Checkpoint F after T51:** multi-line document forms.
7. **Checkpoint G after T53:** E2E/review/regression complete.

## Tradeoffs and Open Questions

- Resize ảnh có thể cần dependency server-side nhỏ, được duyệt nếu dependency hiện tại không hỗ trợ; ưu tiên `sharp`, không xây pipeline ảnh riêng.
- `delete` vẫn là action code chuẩn, nhưng UI dùng `Vô hiệu hóa` cho dữ liệu nghiệp vụ.
- Form edit cho chứng từ nháp nằm ngoài đợt multi-line đầu tiên; chỉ create form được triển khai trong T46-T51.
