# Implementation Plan: Hoàn thiện form, user metadata, phân quyền và thông số sản phẩm v6

Status: active v6 — thêm task cho rule dùng chung trang Thêm/Sửa và tính năng Thông số theo danh mục; đang build theo phase

## Overview

Plan v6 giữ nguyên tiến độ v4 đã build và bổ sung scope mới từ `SPEC.md`: rule list/form bắt buộc dùng route form riêng cho `Thêm mới` và `Sửa`, đồng thời thêm tính năng `Thông số` theo danh mục sản phẩm. Thứ tự ưu tiên: hoàn tất E2E/review v4 còn lại, sau đó làm contract edit-route/detail API, chuyển UI metadata sang form dùng chung, rồi mới thêm permission/DB/API/UI cho thông số sản phẩm.

## Architecture Decisions

- Reset/reseed dữ liệu development khi chạy migration user metadata; `phone` là `NOT NULL`, không backfill số ngẫu nhiên.
- Tách migration `018_user_metadata.sql` và `019_granular_permissions.sql`; migration đã chạy không bị sửa lại.
- Avatar được xác thực theo nội dung, crop 256x256, bỏ metadata và lưu WebP tối đa 200 KB; file đầu vào tối đa 5 MB.
- Thay toàn bộ permission cũ bằng `<feature>.<action>`; không giữ compatibility runtime vì dự án chưa production.
- Hard delete role chỉ khi chưa từng gán user; role đã/đang tham chiếu bị chặn.
- Rule mới: form tạo/sửa dùng chung component; route tạo mới dạng `/resource/create`, route sửa dạng `/resource/:id/edit`; status action như `Vô hiệu hóa` vẫn có thể là row action.
- Thông số sản phẩm dùng definition/value có kiểu rõ ràng; không dùng JSON tự do cho dữ liệu cần validate/query.
- Chi tiết thực thi từng task nằm trong `tasks/task-detail/task-29.md` đến `task-66.md`.

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
                      └─> Detail API/client for edit routes
                          └─> Shared create/edit form routes
                              └─> Product spec permission + DB
                                  └─> Product spec APIs
                                      └─> Product spec UI
                                          └─> E2E + review
```

## Skill Intake Summary

### Stack và work domain

- Frontend: React/Vite/TypeScript/Tailwind, route/component theo `frontend/src/features`.
- Backend: Hono + TypeScript + Zod + PostgreSQL SQL trực tiếp, migration versioned, auth cookie session.
- Domains: form UX/accessibility, upload/resize ảnh, user profile metadata, RBAC chi tiết, API permission enforcement, metadata CRUD, chứng từ nhiều dòng, route form create/edit, product specification definitions/values, browser E2E.

### Applicable existing skills

| Nhóm việc | Skills nên dùng |
|---|---|
| Plan/spec/task | `vibe-plan`, `planning-and-task-breakdown`, `spec-driven-development` |
| Build từng task | `vibe-build`, `incremental-implementation`, `test-driven-development` |
| UI form/role matrix | `frontend-ui-engineering`, `vibe-test` |
| API contract/permission | `api-and-interface-design`, `security-and-hardening` |
| Upload/avatar validation | `security-and-hardening`, `source-driven-development` |
| Data migration/audit | `doubt-driven-development`, `test-driven-development` |
| Create/edit route rule | `frontend-ui-engineering`, `api-and-interface-design`, `test-driven-development` |
| Product specifications | `api-and-interface-design`, `security-and-hardening`, `frontend-ui-engineering`, `test-driven-development` |
| Debug | `debugging-and-error-recovery` |
| Browser evidence | `vibe-e2e`, `browser-testing-with-devtools` |
| Review/simplify | `vibe-review`, `code-review-and-quality`, `vibe-simplify` |

### Missing useful skill gaps

- Có thể cần thư viện resize ảnh server-side hoặc browser-side. Không thêm dependency trong plan; task build phải kiểm tra dependency hiện có trước. Nếu không có giải pháp chuẩn nhỏ gọn, hỏi trước khi thêm dependency.
- Nếu role matrix lặp nhiều logic selection, cân nhắc tạo helper/component nhỏ sau 2 use case thật; không tạo component library sớm.
- Không thiếu skill bắt buộc cho scope mới. Có thể cân nhắc tạo skill riêng cho "metadata form route migration" nếu lặp nhiều ở nhiều repo, nhưng không tạo trong phase plan này.

## Impact Review for v6 Tasks

- T54-T57 ảnh hưởng trực tiếp đến workflow metadata: `Thêm` và `Sửa` chuyển sang route form riêng, nên test cũ cho inline form phải được cập nhật. Hành vi create/update/status hiện có không được đổi.
- T58-T64 ảnh hưởng product/category workflow vì category có thể sinh thông số động cho product form. Category không có required specs vẫn phải tạo/sửa product như trước.
- Luồng chứng từ kho hiện tại như mua hàng, bán hàng, trả hàng, chuyển kho, kiểm kê và xuất kho không bị đổi trực tiếp trong v6; chỉ cần regression đảm bảo product payload mới không làm hỏng các form dùng product.
- T65-T66 là chốt kiểm tra tương thích: E2E route form, E2E thông số, regression permission và review trùng lặp form.

## Permission Review Rule for New Features

Mỗi task thêm tính năng/route/action mới phải có checklist phân quyền:

- [ ] Xác định quyền dùng lại hoặc quyền mới theo dạng `<feature>.<action>`.
- [ ] Cập nhật permission catalog, label tiếng Việt và seed/migration role dev nếu có quyền mới.
- [ ] Cập nhật backend enforcement/route mapping; user thiếu quyền gọi trực tiếp API phải nhận `403`.
- [ ] Cập nhật UI gating: sidebar, toolbar, row action, route create/edit theo đúng quyền.
- [ ] Cập nhật test backend/frontend/E2E hoặc ghi rõ vì sao không cần test mới.

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
- [x] Update role không cho permission rỗng.
- [x] Delete role bị chặn khi đang hoặc đã từng gán user.
- [x] Audit update/delete.

**Verification:**
- [x] `npm test --prefix backend -- --test-name-pattern admin` — 86/86 test pass.
- [x] `npm run build --prefix backend`
- [x] `npm run build --prefix frontend`

**Dependencies:** T34

**Likely files:** `backend/src/modules/admin.ts`, `backend/test/admin.test.ts`, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `test-driven-development`

### Checkpoint D — Metadata APIs

- [x] T39-T42 pass.
- [x] API client expose update/status/delete methods.
- [x] Hard delete boundaries reviewed.

### Phase 5 — Metadata UI actions

#### T43: UI danh mục và đơn vị

**Description:** Nối sửa/vô hiệu hóa category/unit, không còn nút disabled.

**Acceptance criteria:**
- [x] Edit/status cập nhật row không reload.
- [x] Lỗi permission/constraint tiếng Việt.
- [x] Không dùng chữ `Xóa` cho dữ liệu nghiệp vụ.

**Verification:**
- [x] `npm test --prefix frontend -- --run CatalogPage` — 7/7 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T39, T38

**Likely files:** `frontend/src/features/catalog/CatalogPage.tsx`, `frontend/src/features/catalog/CatalogPage.test.tsx`, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T44: UI vị trí và sản phẩm

**Description:** Nối sửa/vô hiệu hóa location/product.

**Acceptance criteria:**
- [x] Location edit/status hoạt động.
- [x] Product edit/status hoạt động.
- [x] Action button hiện theo permission chi tiết.

**Verification:**
- [x] `npm test --prefix frontend -- --run LocationsPage ProductsPage` — 8/8 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T40, T41, T38

**Likely files:** `frontend/src/features/locations/LocationsPage.tsx`, `frontend/src/features/products/ProductsPage.tsx`, related tests

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T45: UI đối tác và role

**Description:** Nối sửa/vô hiệu hóa partner và sửa/xóa role.

**Acceptance criteria:**
- [x] Partner update/status dùng API hiện có và permission chi tiết.
- [x] Role update/delete dùng API mới.
- [x] Delete role đang gán user hiển thị lỗi rõ ràng.

**Verification:**
- [x] `npm test --prefix frontend -- --run PartnersPage AccessPage` — 18/18 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T37, T38, T42

**Likely files:** `frontend/src/features/partners/PartnersPage.tsx`, `frontend/src/features/admin/AccessPage.tsx`, related tests

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

### Checkpoint E — Metadata UX

- [x] T43-T45 pass.
- [x] Không còn nút metadata disabled vì chưa hỗ trợ.
- [ ] Browser smoke cho category, product, partner, role.

### Phase 6 — Multi-line document forms

#### T46: Đơn mua nhiều dòng

**Description:** PO create form nhập nhiều sản phẩm trong một đơn mua.

**Acceptance criteria:**
- [x] `Thêm dòng`, `Xóa dòng` và không xóa dòng cuối.
- [x] Submit nhiều `lines[]` và giữ dòng khi API lỗi.
- [x] Label `Nhà cung cấp (*)` cùng label bắt buộc theo từng dòng.

**Verification:**
- [x] `npm test --prefix frontend -- --run PurchasingPage` — 3/3 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/purchasing/PurchasingPage.tsx`, `frontend/src/features/purchasing/PurchasingPage.test.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T47: Báo giá và đơn bán nhiều dòng

**Description:** Sales create form nhiều dòng, có tổng tiền dòng và tổng chứng từ.

**Acceptance criteria:**
- [x] Thêm/xóa nhiều dòng, không xóa dòng cuối và giữ dữ liệu khi xóa dòng giữa.
- [x] Submit đầy đủ `lines[]` cho báo giá/đơn bán.
- [x] Tổng dòng và tổng chứng từ hiển thị trước khi lưu theo quy tắc làm tròn backend.

**Verification:**
- [x] `npm test --prefix frontend -- --run SalesPage` — 3/3 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/sales/SalesPage.tsx`, `frontend/src/features/sales/SalesPage.test.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T48: Phiếu nhập nhiều dòng với tracking theo từng dòng

**Description:** Receipt create form nhiều dòng, field lot/serial/expiry theo product từng dòng.

**Acceptance criteria:**
- [x] Mỗi dòng có product/location/quantity độc lập.
- [x] Lot/serial/expiry conditional required đúng tracking của từng dòng.
- [x] Đổi sản phẩm xóa field tracking stale và submit đủ payload nhiều dòng.

**Verification:**
- [x] `npm test --prefix frontend -- --run ReceiptPage` — 3/3 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/receipts/ReceiptPage.tsx`, `frontend/src/features/receipts/ReceiptPage.test.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T49: Phiếu xuất nhiều dòng

**Description:** Outbound create form nhiều dòng product/quantity.

**Acceptance criteria:**
- [x] Thêm/xóa dòng, không xóa dòng cuối và validate theo dòng.
- [x] Submit đầy đủ nhiều `lines[]`, giữ form khi API lỗi.
- [x] Reset số phiếu và một dòng sạch sau khi tạo thành công.

**Verification:**
- [x] `npm test --prefix frontend -- --run OutboundPage` — 3/3 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/outbound/OutboundPage.tsx`, `frontend/src/features/outbound/OutboundPage.test.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T50: Trả hàng nhiều dòng

**Description:** Return create form nhiều dòng movement/quantity, sửa nhãn `Trả nhà cung cấp`.

**Acceptance criteria:**
- [x] Thêm/xóa dòng, không xóa dòng cuối và validate số lượng dương theo dòng.
- [x] Submit đầy đủ nhiều `lines[]`, giữ nguyên form khi API báo vượt số lượng.
- [x] Dùng nhãn `Trả nhà cung cấp`, reset về một dòng sạch sau khi tạo thành công.

**Verification:**
- [x] `npm test --prefix frontend -- --run ReturnsPage` — 3/3 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/returns/ReturnsPage.tsx`, `frontend/src/features/returns/ReturnsPage.test.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T51: Chuyển kho và kiểm kê nhiều dòng

**Description:** Transfer create và stock count create hỗ trợ nhiều dòng/tồn trong cùng chứng từ.

**Acceptance criteria:**
- [x] Phiếu chuyển gửi nhiều tồn nguồn/số lượng cùng kho, không xóa dòng cuối.
- [x] Chặn tồn nguồn trùng, số lượng vượt khả dụng và kho đích trùng kho nguồn ngay trên form.
- [x] Kiểm kê chọn nhiều tồn và gửi đầy đủ `stockBalanceIds[]`, không submit lựa chọn rỗng.
- [x] Luồng điều chuyển, hủy, gửi duyệt và duyệt điều chỉnh không đổi.

**Verification:**
- [x] `npm test --prefix frontend -- --run TransfersPage StockCountsPage` — 6/6 test pass.
- [x] `npm run build --prefix frontend`

**Dependencies:** T30, T38

**Likely files:** `frontend/src/features/transfers/TransfersPage.tsx`, `frontend/src/features/stock-counts/StockCountsPage.tsx`, related tests

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

### Checkpoint F — Multi-line forms

- [x] T46-T51 pass.
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

### Phase 8 — Rule dùng chung trang Thêm/Sửa

#### T54: Detail API và client cho form sửa metadata

**Description:** Bổ sung contract đọc chi tiết theo `id` cho các entity metadata cần route sửa, để form `:id/edit` không phụ thuộc vào list page hoặc state cũ.

**Acceptance criteria:**
- [ ] Có API/client lấy chi tiết cho category, unit, location, product, partner, user và role theo warehouse scope.
- [ ] API dùng quyền `*.view`, trả `404` khi không thuộc scope hoặc không tồn tại.
- [ ] Không thay đổi hành vi create/update/status hiện có.

**Verification:**
- [ ] `npm test --prefix backend -- --test-name-pattern "catalog|location|product|partner|admin"`
- [ ] `npm run build --prefix backend`
- [ ] `npm test --prefix frontend -- --run api`

**Dependencies:** T53

**Likely files:** `backend/src/modules/catalog.ts`, `backend/src/modules/locations.ts`, `backend/src/modules/products.ts`, `backend/src/modules/partners.ts`, `backend/src/modules/admin.ts`, `backend/src/modules/permissions.ts`, `frontend/src/lib/api.ts`, related backend tests

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `test-driven-development`

#### T55: Route form dùng chung cho danh mục và đơn vị

**Description:** Chuyển create/edit category và unit sang route form riêng dùng chung component; list chỉ còn table/filter/action.

**Acceptance criteria:**
- [ ] `Thêm danh mục` mở `/catalog/categories/create`, `Sửa` mở `/catalog/categories/:id/edit`; cả hai dùng cùng form component.
- [ ] `Thêm đơn vị` mở `/catalog/units/create`, `Sửa` mở `/catalog/units/:id/edit`; cả hai dùng cùng form component.
- [ ] Edit mode load dữ liệu theo `id`, có loading/error/not found, submit gọi update; create mode gọi create.
- [ ] List không còn inline edit form cho category/unit.

**Verification:**
- [ ] `npm test --prefix frontend -- --run CatalogPage`
- [ ] `npm run build --prefix frontend`

**Dependencies:** T54

**Likely files:** `frontend/src/App.tsx`, `frontend/src/features/catalog/CatalogPage.tsx`, `frontend/src/features/catalog/CatalogPage.test.tsx`, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T56: Route form dùng chung cho vị trí và sản phẩm

**Description:** Chuyển create/edit location và product sang route form riêng dùng chung component.

**Acceptance criteria:**
- [ ] `Thêm vị trí` và `Sửa vị trí` dùng cùng form route create/edit.
- [ ] `Thêm sản phẩm` và `Sửa sản phẩm` dùng cùng form route create/edit.
- [ ] Product edit giữ các rule an toàn hiện có: không sửa tracking/SKU khi đã có lịch sử; status vẫn là row action.
- [ ] List không còn inline edit form cho location/product.

**Verification:**
- [ ] `npm test --prefix frontend -- --run LocationsPage ProductsPage`
- [ ] `npm run build --prefix frontend`

**Dependencies:** T54, T55

**Likely files:** `frontend/src/App.tsx`, `frontend/src/features/locations/LocationsPage.tsx`, `frontend/src/features/products/ProductsPage.tsx`, related tests, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T57: Route form dùng chung cho đối tác, người dùng và vai trò

**Description:** Chuyển edit partner, user và role sang route form riêng dùng chung create/edit component; giữ gán role/status action phù hợp.

**Acceptance criteria:**
- [ ] Partner create/edit dùng chung form; list không inline edit.
- [ ] User create/edit dùng chung form; avatar/metadata hoạt động ở edit mode.
- [ ] Role create/edit dùng chung form; permission matrix load đúng role hiện có.
- [ ] Status actions như `Vô hiệu hóa/Kích hoạt` vẫn là row action có confirm.

**Verification:**
- [ ] `npm test --prefix frontend -- --run PartnersPage AccessPage`
- [ ] `npm run build --prefix frontend`

**Dependencies:** T54, T55

**Likely files:** `frontend/src/App.tsx`, `frontend/src/features/partners/PartnersPage.tsx`, `frontend/src/features/admin/AccessPage.tsx`, related tests, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `security-and-hardening`, `test-driven-development`

### Checkpoint H — Shared create/edit route rule

- [ ] T54-T57 pass.
- [ ] Metadata list pages không còn inline update form.
- [ ] Route create/edit dùng quyền đúng mode: `*.create` cho create, `*.update` cho edit.
- [ ] Human review xác nhận UX route mới trước khi thêm thông số.

### Phase 9 — Backend thông số sản phẩm

#### T58: Permission catalog và migration cho thông số

**Description:** Thêm permission `catalog.specs.*` và schema lưu definition/option/value thông số theo danh mục.

**Acceptance criteria:**
- [x] Permission catalog có `catalog.specs.view/create/update/delete`, label tiếng Việt và route mapping dự kiến.
- [x] Permission review checklist hoàn tất cho feature `catalog.specs`.
- [x] Migration thêm `category_spec_definitions`, `category_spec_options`, `product_spec_values` hoặc tên tương đương.
- [x] DB ràng buộc unique theo danh mục/code, option theo definition/value, và value typed theo type.
- [x] Seed role dev cập nhật quyền mới cho warehouse admin.

**Verification:**
- [x] `npm run db:migrate --prefix backend`
- [x] `npm test --prefix backend -- products.test.ts catalog-specs.test.ts`
- [x] `npm run build --prefix backend`

**Dependencies:** Checkpoint H

**Likely files:** `backend/db/migrations/022_product_specs.sql`, `backend/src/modules/permissions.ts`, `backend/src/db/seed.ts`, `backend/test/admin.test.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `test-driven-development`

#### T59: API quản lý thông số danh mục

**Description:** Thêm API CRUD/status cho spec definitions và options theo danh mục.

**Acceptance criteria:**
- [x] List/create/update/status spec definition theo category và warehouse scope.
- [x] API enforce `catalog.specs.view/create/update/delete`; thiếu quyền trả `403` kể cả gọi trực tiếp.
- [x] `select` bắt buộc có option; number hỗ trợ unit/min/max; code duy nhất trong danh mục.
- [x] Không hard delete definition/option đã có product value; dùng status `inactive`.
- [x] Audit create/update/status cho definition và option.

**Verification:**
- [x] `npm test --prefix backend -- catalog-specs.test.ts`
- [x] `npm run build --prefix backend`

**Dependencies:** T58

**Likely files:** `backend/src/modules/catalog-specs.ts`, `backend/src/index.ts`, `backend/src/modules/permissions.ts`, `backend/test/catalog-specs.test.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `test-driven-development`

#### T60: Product API nhận và trả giá trị thông số

**Description:** Mở rộng product create/update/detail/list để lưu, validate và trả typed spec values theo category.

**Acceptance criteria:**
- [x] Product create/update nhận `specValues[]` hoặc shape typed tương đương và validate theo definitions active của category.
- [x] Product create/update không yêu cầu `specValues` khi category không có required specs, để giữ workflow product cũ.
- [x] Required thiếu, number sai min/max, select option inactive/sai category, boolean sai type đều trả `422`.
- [x] Không cho ghi value cho definition không thuộc category của product.
- [x] Product detail/edit trả cả value cũ của definition inactive để hiển thị lịch sử.

**Verification:**
- [x] `npm test --prefix backend -- products.test.ts`
- [x] `npm run build --prefix backend`

**Dependencies:** T59

**Likely files:** `backend/src/modules/products.ts`, `backend/src/modules/catalog-specs.ts`, `backend/test/products.test.ts`, `backend/test/catalog-specs.test.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `security-and-hardening`, `test-driven-development`

### Checkpoint I — Backend thông số

- [x] T58-T60 pass.
- [x] API contract đủ cho UI danh mục thông số và product form.
- [x] Không có JSON tự do cho dữ liệu cần validate/query.

### Phase 10 — UI thông số sản phẩm

#### T61: API client và type frontend cho thông số

**Description:** Thêm type/client cho spec definitions, options và product spec values.

**Acceptance criteria:**
- [ ] `frontend/src/lib/api.ts` có type rõ cho `text`, `number`, `boolean`, `select`.
- [ ] Client có method list/create/update/status definitions/options và product create/update/detail có spec values.
- [ ] API test cover `VITE_API_BASE_URL` vẫn pass sau khi thêm method.

**Verification:**
- [ ] `npm test --prefix frontend -- --run src/lib/api.test.ts`
- [ ] `npm run build --prefix frontend`

**Dependencies:** T60

**Likely files:** `frontend/src/lib/api.ts`, `frontend/src/lib/api.test.ts`

**Recommended skills:** `vibe-build`, `api-and-interface-design`, `test-driven-development`

#### T62: UI quản lý Thông số trong danh mục

**Description:** Thêm action `Thông số` ở category list và màn hình quản lý definitions/options cho category.

**Acceptance criteria:**
- [ ] Category row có action `Thông số` khi có `catalog.specs.view`.
- [ ] Admin thêm/sửa/vô hiệu hóa/kích hoạt definition và option theo quyền.
- [ ] User thiếu quyền ghi chỉ xem được hoặc bị ẩn action; gọi API trực tiếp bị backend trả `403`.
- [ ] UI validate `select` phải có option, required/min/max/unit đúng label `(*)` khi cần.
- [ ] Row update không cần reload trang; lỗi hiển thị tiếng Việt.

**Verification:**
- [ ] `npm test --prefix frontend -- --run CatalogPage`
- [ ] `npm run build --prefix frontend`

**Dependencies:** T61

**Likely files:** `frontend/src/App.tsx`, `frontend/src/features/catalog/CatalogPage.tsx`, `frontend/src/features/catalog/CatalogPage.test.tsx`, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

#### T63: Product create/edit tự render thông số theo danh mục

**Description:** Product form dùng chung create/edit tự tải và render section `Thông số` theo category đang chọn.

**Acceptance criteria:**
- [ ] Chọn category thì form tải definitions active và render field theo type.
- [ ] Required có `(*)`; missing value chặn submit trước khi gọi API khi có thể.
- [ ] Đổi category sau khi nhập value có cảnh báo; không âm thầm xóa dữ liệu.
- [ ] Edit mode load product spec values hiện có và submit update đúng payload.

**Verification:**
- [ ] `npm test --prefix frontend -- --run ProductsPage`
- [ ] `npm run build --prefix frontend`

**Dependencies:** T61, T62

**Likely files:** `frontend/src/features/products/ProductsPage.tsx`, `frontend/src/features/products/ProductsPage.test.tsx`, `frontend/src/lib/api.ts`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `security-and-hardening`, `test-driven-development`

#### T64: Hiển thị thông số trong danh sách/chi tiết sản phẩm

**Description:** Hiển thị giá trị thông số quan trọng trong product list/detail/edit mà không làm bảng vỡ layout.

**Acceptance criteria:**
- [ ] Product edit/detail hiển thị toàn bộ spec values, kể cả definition inactive đã có dữ liệu.
- [ ] Product list hiển thị tóm tắt thông số gọn hoặc có vùng mở rộng; không ép tất cả thông số vào nhiều cột gây vỡ bảng.
- [ ] Empty/loading/error states rõ ràng khi category chưa có thông số.

**Verification:**
- [ ] `npm test --prefix frontend -- --run ProductsPage`
- [ ] `npm run build --prefix frontend`

**Dependencies:** T63

**Likely files:** `frontend/src/features/products/ProductsPage.tsx`, `frontend/src/features/products/ProductsPage.test.tsx`

**Recommended skills:** `vibe-build`, `frontend-ui-engineering`, `test-driven-development`

### Checkpoint J — UI thông số

- [ ] T61-T64 pass.
- [ ] Admin tạo được definitions/options theo danh mục.
- [ ] Product create/edit tự render và lưu spec values đúng type.
- [ ] Human review xác nhận chưa cần kế thừa danh mục cha, biến thể SKU hoặc lọc nâng cao.

### Phase 11 — E2E và review v6

#### T65: Browser E2E cho route form và thông số

**Description:** Chạy E2E mới cho create/edit route rule và product specifications, ghi evidence.

**Acceptance criteria:**
- [ ] E2E-020 create/edit route rule pass.
- [ ] E2E-021 product specifications pass.
- [ ] Evidence có URL, role, viewport, console/network và screenshot khi khả dụng.

**Verification:**
- [ ] `$vibe-e2e E2E-020`
- [ ] `$vibe-e2e E2E-021`

**Dependencies:** T57, T64

**Likely files:** `tasks/test-result.md`

**Recommended skills:** `vibe-e2e`, `browser-testing-with-devtools`

#### T66: Review và cleanup v6

**Description:** Review toàn bộ scope route form + product specs, chạy regression rộng và đơn giản hóa code lặp.

**Acceptance criteria:**
- [ ] Full lint/build/test pass hoặc blocker ghi rõ.
- [ ] Review không còn high/medium finding chưa xử lý.
- [ ] Không duplicate form create/edit lớn ở các metadata/product page.
- [ ] Permission `catalog.specs.*` và route create/edit metadata được enforce backend, reflected UI và có regression thiếu quyền.

**Verification:**
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] `$vibe-review`

**Dependencies:** T65

**Likely files:** all files changed by T54-T65

**Recommended skills:** `vibe-review`, `code-review-and-quality`, `vibe-simplify`

## Phase Checkpoints

1. **Checkpoint A after T30:** required marker and Vietnamese label baseline.
2. **Checkpoint B after T33:** user metadata and avatar upload.
3. **Checkpoint C after T38:** granular permission model and UI matrix.
4. **Checkpoint D after T42:** metadata APIs ready.
5. **Checkpoint E after T45:** metadata UI actions usable.
6. **Checkpoint F after T51:** multi-line document forms.
7. **Checkpoint G after T53:** E2E/review/regression complete.
8. **Checkpoint H after T57:** shared create/edit route rule complete.
9. **Checkpoint I after T60:** backend product specs contract complete.
10. **Checkpoint J after T64:** frontend product specs complete.
11. **Checkpoint K after T66:** E2E/review v6 complete.

## Tradeoffs and Open Questions

- Resize ảnh có thể cần dependency server-side nhỏ, được duyệt nếu dependency hiện tại không hỗ trợ; ưu tiên `sharp`, không xây pipeline ảnh riêng.
- `delete` vẫn là action code chuẩn, nhưng UI dùng `Vô hiệu hóa` cho dữ liệu nghiệp vụ.
- Form edit cho chứng từ nháp nằm ngoài đợt multi-line đầu tiên; chỉ create form được triển khai trong T46-T51.
- Scope thông số MVP áp dụng trực tiếp theo category của product; chưa kế thừa category cha, chưa tạo biến thể SKU, chưa lọc nâng cao theo thông số.
- Product list không nên mở rộng thành bảng nhiều cột động cho mọi thông số; ưu tiên summary/expand để giữ layout ổn định.
- Permission review là rule bắt buộc khi thêm tính năng mới; nếu task dùng lại quyền hiện có thì phải ghi rõ trong acceptance criteria hoặc implementation note.
