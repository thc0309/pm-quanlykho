# Implementation Plan: Hệ thống quản lý kho đa ngành

Status: draft v2 — Hono/PostgreSQL, chờ duyệt trước khi build

## Overview

Ưu tiên một MVP chạy thật theo chiều dọc: đăng nhập → quản lý kho/vị trí/sản phẩm → nhận tồn → tạo phiếu xuất và reserve → soạn bằng quét → user khác kiểm → xác nhận xuất mới giảm tồn. Các module thương mại, báo cáo và in triển khai sau checkpoint MVP.

Mặc định đã dùng để lập plan: người kiểm khác người soạn; quét kệ trước quét hàng; reservation chưa bắt đầu hết hạn sau 30 phút; thiếu hàng quay về `needs_repick`, supervisor mới được xuất thiếu; outbound là flow đầu tiên.

## Architecture Decisions

- Backend: Hono + Node.js + TypeScript strict + Zod + `pg`; SQL trực tiếp, migration cộng dồn, không ORM.
- Frontend: React/Vite/Tailwind trong `frontend/`; tái sử dụng component template có ích, xóa demo theo từng màn hình thật.
- Không tạo `packages/`, generic repository hay OpenAPI generator ở MVP. Zod schema và response type đặt gần route; chỉ tách khi có reuse thật.
- `StockMovement` bất biến; `on_hand`, reservation và state transition thay đổi trong PostgreSQL transaction.
- Một phiếu chỉ có một picker/checker active. Ship phải idempotent và khóa stock/reservation row liên quan.
- Mỗi task build tối đa khoảng 5 file cụ thể. Nếu lúc build vượt giới hạn, tách task trước khi sửa code.

## Dependency Order

```text
T01 backend baseline ─┬─> T03 HTTP contract ─> T04 auth API ─> T05 login UI
T02 frontend baseline ┘                               │
                                                     └─> T06 permission API ─> T07 admin UI
T07 ─> T08 locations ─> T09 catalog ─> T10 products ─┬─> T12 stock core
T07 ─> T11 partners ──────────────────────────────────┘
T12 ─> T13 receipt ─> T14 inventory/trace ─> T15 reserve/outbound
T15 ─> T16 picking ─> T17 checking/shipping ─> T18 exceptions ─> T19 critical E2E
T19 ─> T20..T26 extended modules ─> T28 launch review
T27 Tauri is optional and starts only after T26 device evidence.
```

## Skill Intake Summary

### Detected stack and work domains

- Hono API, raw PostgreSQL transactions/migrations, Zod validation and cookie sessions.
- React 19, Vite 6, Tailwind 4, responsive mobile/PWA scanner UI.
- Warehouse isolation, RBAC, immutable movement, lot/serial/FEFO, reservation and concurrency.
- Browser/device validation, accessibility, security, reporting, print and optional Tauri.

### Applicable existing skills

| Domain | Skills to use |
|---|---|
| Every build task | `vibe-build`, `incremental-implementation`, `test-driven-development` |
| API/contracts/SQL | `api-and-interface-design`, `security-and-hardening`, `source-driven-development` |
| Auth, permission, stock concurrency | add `doubt-driven-development` |
| React/mobile UI | `frontend-ui-engineering`, `vibe-test` |
| Browser/device checks | `browser-testing-with-devtools`, `vibe-e2e` |
| Cleanup/review | `vibe-simplify`, `vibe-review`, `code-review-and-quality` |
| Launch | `vibe-ship`, `shipping-and-launch`, `performance-optimization` |
| Architecture decisions | `documentation-and-adrs` only for expensive-to-reverse decisions |

### Missing useful skills — do not install/create automatically

- Hono + raw PostgreSQL transaction/concurrency recipes: create a local skill only if repeated implementation mistakes appear; official docs plus existing API/security skills are sufficient initially.
- GS1/advanced barcode parsing: install/create only if GTIN/GS1 application identifiers enter scope; MVP treats barcode as validated identifiers.
- Tauri Windows silent printing: find/create a dedicated skill after printer model, driver and protocol are confirmed.

## Task Plan

### Phase 1 — Reliable foundation and access

### T01: Make the backend baseline truthful

**Acceptance:** health test is TypeScript; backend test/build commands pass; scripts do not advertise an unusable production start path.

**Verification:** `npm test --prefix backend`; `npm run build --prefix backend`; request `GET /health` and verify the stable JSON envelope.

**Evidence (2026-07-15):** `npm test --prefix backend` passed 1/1 TypeScript health test; `npm run build --prefix backend` passed. Removed the unusable emitted-file `start` script.

**Dependencies:** None.

**Likely files:** `backend/package.json`, `backend/tsconfig.json`, `backend/test/health.test.ts`, `backend/test/health.test.mjs`, `backend/src/app.ts`.

**Skills:** `vibe-build`, `vibe-test`, `debugging-and-error-recovery` if sandbox/process errors recur.

### T02: Stabilize the copied frontend template

**Acceptance:** current template lint/build pass; known `any`/CommonJS lint errors are removed; no business feature is added.

**Verification:** `npm run lint --prefix frontend`; `npm run build --prefix frontend`.

**Evidence (2026-07-15):** frontend lint passed with 0 errors (2 existing Fast Refresh warnings); production build passed. Removed explicit `any` and CommonJS type import errors.

**Dependencies:** None.

**Likely files:** `frontend/src/components/ecommerce/CountryMap.tsx`, `frontend/src/pages/Calendar.tsx`, `frontend/src/svg.d.ts`, `frontend/eslint.config.js` only if required.

**Skills:** `vibe-build`, `frontend-ui-engineering`, `debugging-and-error-recovery`.

### T03: Establish the HTTP contract boundary

**Acceptance:** Hono has one error shape, request validation helper, request ID and bounded pagination parser; invalid input never leaks internals.

**Verification:** contract tests cover `404`, malformed query, pagination bounds and unexpected error; backend build/test pass.

**Evidence (2026-07-15):** `http-contract.test.ts` passed 4/4; full backend suite passed 5/5 and TypeScript build passed. Boundary now provides request IDs, stable errors, JSON validation and pagination capped at 100 rows.

**Dependencies:** T01.

**Likely files:** `backend/src/app.ts`, `backend/src/http/errors.ts`, `backend/src/http/validation.ts`, `backend/test/http-contract.test.ts`.

**Skills:** `api-and-interface-design`, `security-and-hardening`, `vibe-test`.

### T04: Implement session authentication API

**Acceptance:** seeded master can log in, change temporary password and log out; cookie is `httpOnly`/`sameSite` and production-secure; public signup is absent; session/token/password values are never returned or logged.

**Verification:** tests cover login success/failure, expired/revoked session, forced password change and missing signup route.

**Evidence (2026-07-15):** auth tests passed 6/6 covering secure cookie flags, generic login failure, rate limiting, expired/revoked sessions, forced password change, logout and absent signup. Full backend suite passed 11/11; TypeScript build passed. Master seed requires runtime `MASTER_EMAIL`/`MASTER_PASSWORD` and stores only a scrypt hash.

**Dependencies:** T03.

**Likely files:** `backend/package.json`, `backend/db/migrations/002_auth.sql`, `backend/src/modules/auth.ts`, `backend/src/domain/password.ts`, `backend/test/auth.test.ts`.

**Skills:** `security-and-hardening`, `api-and-interface-design`, `doubt-driven-development`, `vibe-test`.

### T05: Deliver the login and forced-password UI

**Acceptance:** real API-backed login/change-password/logout replaces template auth demo; loading/errors/disabled states work; signup is inaccessible.

**Verification:** component tests for form behavior; browser check at 320/768/1024/1440 px with keyboard and no console errors.

**Evidence (2026-07-15):** Auth component tests passed 3/3; frontend lint/build passed and npm audit reported 0 vulnerabilities. Browser verified 320/768/1024/1440 without horizontal overflow, logical Email → Password → Login focus order, accessible labels and zero console warnings/errors. Removing unused Swiper/template routes reduced production JS from ~1.95 MB to 235 KB.

**Dependencies:** T02, T04.

**Likely files:** `frontend/package.json`, `frontend/src/App.tsx`, `frontend/src/lib/api.ts`, `frontend/src/features/auth/AuthPage.tsx`, `frontend/src/features/auth/AuthPage.test.tsx`.

**Skills:** `frontend-ui-engineering`, `vibe-test`, `browser-testing-with-devtools`.

### T06: Enforce warehouse permissions in the API

**Acceptance:** session determines warehouse and permissions; APIs can require `outbound.pick/check/ship/resolveDiscrepancy`; direct cross-warehouse and denied requests return `403`; protected changes create audit rows.

**Verification:** integration matrix covers `401/403`, master scope, warehouse isolation and audit actor/action/target.

**Evidence (2026-07-15):** access tests passed 4/4 for unauthenticated, denied permission, cross-warehouse denial, master scope and immutable audit payload. Full backend suite passed 15/15 and TypeScript build passed. Permission codes support distinct pick/check/ship/discrepancy actions.

**Dependencies:** T04.

**Likely files:** `backend/db/migrations/003_permissions.sql`, `backend/src/http/auth.ts`, `backend/src/modules/access.ts`, `backend/test/access.test.ts`.

**Skills:** `security-and-hardening`, `api-and-interface-design`, `doubt-driven-development`, `vibe-test`.

### T07: Deliver warehouse user and role administration

**Acceptance:** warehouse admin can list/create/disable users, define roles and assign permissions; denied controls are absent but API remains authoritative.

**Verification:** backend tests for scoped CRUD; component/browser test creates picker and checker roles and confirms denied navigation.

**Evidence (2026-07-15):** scoped admin API tests passed 3/3, including denied permission and cross-warehouse status changes. Access component tests passed 4/4, including role assignment; Chrome created picker/checker roles, created a warehouse user and assigned the picker role through the real API. Full suite passed 25/25, lint had 0 errors and both production builds passed.

**Dependencies:** T05, T06.

**Likely files:** `backend/src/modules/admin.ts`, `backend/test/admin.test.ts`, `frontend/src/features/admin/AccessPage.tsx`, `frontend/src/features/admin/AccessPage.test.tsx`, `frontend/src/layout/AppSidebar.tsx`.

**Skills:** `api-and-interface-design`, `security-and-hardening`, `frontend-ui-engineering`, `vibe-test`.

### Checkpoint A — Access foundation

- All T01–T07 commands pass.
- Browser proves login, forced password change and picker/checker permission separation.
- Human reviews password hashing choice and whether `admin_template/` can now be deleted.
- Stop for review/context reset before inventory schema work.

**Review decision (2026-07-15):** approved to continue under the user's explicit uninterrupted-build instruction. Node `scrypt` parameters and session handling remain covered by authentication/security tests. `admin_template/` is retained because deletion was not required for the product path and would be destructive cleanup without measurable runtime benefit.

### Phase 2 — Master data and real stock

### T08: Deliver warehouse locations

**Acceptance:** admin manages `storage/staging/shipping` locations with warehouse-unique code/barcode; scan lookup cannot cross warehouse.

**Verification:** API/component tests cover duplicates, invalid type and barcode lookup; browser creates one location of each type.

**Dependencies:** T07.

**Likely files:** `backend/db/migrations/004_locations.sql`, `backend/src/modules/locations.ts`, `backend/test/locations.test.ts`, `frontend/src/features/locations/LocationsPage.tsx`, `frontend/src/features/locations/LocationsPage.test.tsx`.

**Skills:** `api-and-interface-design`, `frontend-ui-engineering`, `security-and-hardening`, `vibe-test`.

### T09: Deliver the minimum catalog and unit slice

**Acceptance:** admin manages category, base unit and conversion; invalid or ambiguous conversion is rejected; no speculative attribute engine is added beyond confirmed needs.

**Verification:** conversion unit tests; scoped API tests; browser creates a category and converted unit.

**Dependencies:** T07.

**Likely files:** `backend/db/migrations/005_catalog.sql`, `backend/src/modules/catalog.ts`, `backend/test/catalog.test.ts`, `frontend/src/features/catalog/CatalogPage.tsx`, `frontend/src/features/catalog/CatalogPage.test.tsx`.

**Skills:** `api-and-interface-design`, `frontend-ui-engineering`, `test-driven-development`, `vibe-test`.

### T10: Deliver products and barcode lookup

**Acceptance:** admin manages stock products with tracking/FEFO/expiry policy and multiple unique barcodes; scanner lookup returns the correct warehouse product.

**Verification:** API tests cover duplicate SKU/barcode and invalid tracking policy; browser creates and resolves products for none/lot/serial tracking.

**Dependencies:** T08, T09.

**Likely files:** `backend/db/migrations/006_products.sql`, `backend/src/modules/products.ts`, `backend/test/products.test.ts`, `frontend/src/features/products/ProductsPage.tsx`, `frontend/src/features/products/ProductsPage.test.tsx`.

**Skills:** `api-and-interface-design`, `frontend-ui-engineering`, `security-and-hardening`, `vibe-test`.

### T11: Deliver partner management

**Acceptance:** admin manages scoped customer/supplier records with unique codes and validated contact/tax fields.

**Verification:** API/component tests cover create/update/disable, duplicate code and warehouse isolation.

**Dependencies:** T07.

**Likely files:** `backend/src/modules/partners.ts`, `backend/test/partners.test.ts`, `frontend/src/features/partners/PartnersPage.tsx`, `frontend/src/features/partners/PartnersPage.test.tsx`.

**Skills:** `api-and-interface-design`, `frontend-ui-engineering`, `security-and-hardening`, `vibe-test`.

### T12: Build the stock ledger and balance core

**Acceptance:** one transaction posts immutable movements and maintains/query balances by warehouse+location+product+lot/serial; negative stock is rejected; duplicate serial is rejected.

**Verification:** domain/integration tests cover receipt/issue math, rollback, lot/serial uniqueness and concurrent conflicting writes.

**Dependencies:** T08, T10.

**Likely files:** `backend/db/migrations/007_stock_core.sql`, `backend/src/domain/stock.ts`, `backend/src/modules/stock.ts`, `backend/test/stock.test.ts`.

**Skills:** `test-driven-development`, `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`.

### T13: Deliver receiving with lot/serial

**Acceptance:** authorized user creates and confirms a receipt into a location; confirmation increases stock once; expiry-required lot and serial rules are enforced.

**Verification:** API/UI tests cover none/lot/serial receipt, FEFO metadata and idempotent confirm; browser receives stock usable by outbound.

**Dependencies:** T10, T11, T12.

**Likely files:** `backend/db/migrations/008_receipts.sql`, `backend/src/modules/receipts.ts`, `backend/test/receipts.test.ts`, `frontend/src/features/receipts/ReceiptPage.tsx`, `frontend/src/features/receipts/ReceiptPage.test.tsx`.

**Skills:** `api-and-interface-design`, `doubt-driven-development`, `frontend-ui-engineering`, `vibe-test`.

### T14: Deliver inventory and traceability views

**Acceptance:** users can view paginated `on_hand/committed/available`, lots/serials and movement history; warehouse isolation and bounded filters apply.

**Verification:** API tests prove totals and no leakage; browser checks loading/error/empty/filter/pagination states.

**Dependencies:** T12, T13.

**Likely files:** `backend/src/modules/inventory.ts`, `backend/test/inventory.test.ts`, `frontend/src/features/inventory/InventoryPage.tsx`, `frontend/src/features/inventory/InventoryPage.test.tsx`.

**Skills:** `api-and-interface-design`, `frontend-ui-engineering`, `performance-optimization`, `vibe-test`.

### Checkpoint B — Stock foundation

- Receive none/lot/serial products and reconcile movement totals to inventory.
- Warehouse isolation, FEFO metadata and concurrent negative-stock checks pass.
- Review schema/recovery notes before adding reservation state.
- Stop for review/context reset.

### Phase 3 — Critical outbound MVP

### T15: Deliver outbound draft and reservation release

**Acceptance:** authorized user creates an outbound document and releases it to `ready_to_pick`; reservation uses FEFO stock key, reduces `available` but not `on_hand`, expires after 30 minutes if untouched and is idempotent.

**Verification:** tests cover insufficient stock, concurrent releases, retry, expiry and `on_hand/available`; browser creates/releases a document.

**Dependencies:** T11, T12, T14.

**Likely files:** `backend/db/migrations/009_outbound_reservations.sql`, `backend/src/modules/outbound.ts`, `backend/test/outbound-release.test.ts`, `frontend/src/features/outbound/OutboundPage.tsx`, `frontend/src/features/outbound/OutboundPage.test.tsx`.

**Skills:** `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`, `frontend-ui-engineering`, `vibe-test`.

### T16: Deliver the picker workflow

**Acceptance:** one active picker claims/resumes a phiếu, must scan location then product/lot/serial, and confirms `picked`; progress persists per scan; `on_hand` remains unchanged and reservation becomes `picked`.

**Verification:** tests cover wrong shelf/item/lot/serial, FEFO override denial, duplicate scan, resume and competing picker; mobile browser completes a pick.

**Dependencies:** T15.

**Likely files:** `backend/db/migrations/010_picking.sql`, `backend/src/modules/picking.ts`, `backend/test/picking.test.ts`, `frontend/src/features/picking/PickingPage.tsx`, `frontend/src/features/picking/PickingPage.test.tsx`.

**Skills:** `api-and-interface-design`, `doubt-driven-development`, `frontend-ui-engineering`, `browser-testing-with-devtools`, `vibe-test`.

### T17: Deliver independent checking and shipping

**Acceptance:** a different authorized user claims `picked`, rescans at staging and confirms shipment; one transaction validates version/reservation, creates movements, consumes reservation and decrements `on_hand` exactly once.

**Verification:** tests cover same-user denial, wrong/short/extra scan, stale version, duplicate idempotency key and concurrent ship; mobile browser completes check/ship.

**Dependencies:** T16.

**Likely files:** `backend/db/migrations/011_checking.sql`, `backend/src/modules/checking.ts`, `backend/test/checking.test.ts`, `frontend/src/features/checking/CheckingPage.tsx`, `frontend/src/features/checking/CheckingPage.test.tsx`.

**Skills:** `api-and-interface-design`, `security-and-hardening`, `doubt-driven-development`, `frontend-ui-engineering`, `vibe-test`.

### T18: Deliver discrepancy, re-pick, cancellation and reassignment

**Acceptance:** mismatch goes to `needs_repick`; supervisor can approve short ship with reason; unpicked cancellation releases reservation; picked cancellation requires return scan; assignment changes are audited.

**Verification:** tests cover each state transition and forbid direct status edits; browser demonstrates re-pick, supervisor decision and return-to-stock cancellation.

**Dependencies:** T16, T17.

**Likely files:** `backend/src/domain/outbound-state.ts`, `backend/src/modules/outbound-exceptions.ts`, `backend/test/outbound-exceptions.test.ts`, `frontend/src/features/outbound/OutboundExceptions.tsx`, `frontend/src/features/outbound/OutboundExceptions.test.tsx`.

**Skills:** `test-driven-development`, `security-and-hardening`, `doubt-driven-development`, `frontend-ui-engineering`, `vibe-test`.

### T19: Prove and harden the critical flow

**Acceptance:** automated integration plus browser evidence proves receipt → reserve → pick → independent check → ship; duplicate/concurrent requests never double-decrement; API hot-path query/lock behavior is measured.

**Verification:** `npm test`; `npm run lint`; `npm run build`; execute E2E-001–E2E-010 from `tasks/test-plan.md`; record results in `tasks/test-result.md`.

**Dependencies:** T13–T18.

**Likely files:** `backend/test/outbound-flow.test.ts`, `frontend/src/features/outbound/outbound-flow.test.tsx`, `tasks/test-result.md`.

**Skills:** `vibe-test`, `vibe-e2e`, `browser-testing-with-devtools`, `performance-optimization`, `vibe-review`.

### Checkpoint C — Outbound MVP

- Critical workflow passes with two real roles and mobile viewport evidence.
- `picked` leaves `on_hand` unchanged; `shipped` decrements exactly once.
- Human decides whether this MVP is released internally before extended modules.
- Stop for review/context reset.

### Phase 4 — Extended warehouse modules

### T20: Add purchase orders

**Acceptance:** create/approve PO and receive partial/full quantities through T13; PO itself does not change stock.

**Verification:** API/UI tests prove outstanding quantity, duplicate receipt protection and supplier scope.

**Dependencies:** T11, T13, T19.

**Likely files:** migration, one backend module/test and one frontend feature/test under `purchasing`.

**Skills:** `api-and-interface-design`, `frontend-ui-engineering`, `vibe-test`.

### T21: Add quote, sales order and commercial invoice

**Acceptance:** quote/order creates an outbound document without changing stock; shipped data produces an immutable invoice snapshot.

**Verification:** API/UI tests cover totals, status transitions and snapshot immutability.

**Dependencies:** T11, T17, T19.

**Likely files:** migration, one backend module/test and one frontend feature/test under `sales`.

**Skills:** `api-and-interface-design`, `frontend-ui-engineering`, `test-driven-development`, `vibe-test`.

### T22: Add customer and supplier returns

**Acceptance:** returns reference original documents, validate quantity/lot/serial and post the correct immutable movement once.

**Verification:** API/UI tests cover over-return, duplicate confirm and traceability.

**Dependencies:** T13, T17, T21.

**Likely files:** migration, one backend module/test and one frontend feature/test under `returns`.

**Skills:** `doubt-driven-development`, `api-and-interface-design`, `frontend-ui-engineering`, `vibe-test`.

### T23: Add stock count and approved adjustment

**Acceptance:** count freezes a scoped snapshot, records actual quantity and posts variance only after approval; confirmed records remain immutable.

**Verification:** tests cover concurrent movement conflict, positive/negative variance and permission/audit.

**Dependencies:** T12, T19.

**Likely files:** migration, one backend module/test and one frontend feature/test under `stock-counts`.

**Skills:** `doubt-driven-development`, `security-and-hardening`, `frontend-ui-engineering`, `vibe-test`.

### T24: Add two-sided warehouse transfer

**Acceptance:** transfer-out moves stock to in-transit; destination receipt moves it to target location; cancel/reversal cannot duplicate stock.

**Verification:** tests reconcile source+transit+destination and enforce warehouse permissions.

**Dependencies:** T12, T13, T19.

**Likely files:** migration, one backend module/test and one frontend feature/test under `transfers`.

**Skills:** `doubt-driven-development`, `api-and-interface-design`, `frontend-ui-engineering`, `vibe-test`.

### T25: Add dashboard, reports and bounded export

**Acceptance:** inventory/expiry/movement summaries use scoped paginated queries; CSV export obeys filters/permissions and has a row limit.

**Verification:** query tests across warehouses; browser loading/empty/error/filter/export; measure representative response time and query plan.

**Dependencies:** T20–T24.

**Likely files:** one backend report module/test, one frontend report feature/test and dashboard page.

**Skills:** `performance-optimization`, `security-and-hardening`, `frontend-ui-engineering`, `vibe-test`.

### T26: Add web print, labels and PWA device evidence

**Acceptance:** confirmed documents and product/lot/serial labels have print layouts; system print is used; keyboard scanner and Android camera are verified; duplicate stock mutation is impossible from reprint/retry.

**Verification:** browser/device checks at required viewports, printer dialog evidence and E2E-011–E2E-013.

**Dependencies:** T19, T21, T25.

**Likely files:** print route/component/styles, scanner adapter, manifest/config and test evidence.

**Skills:** `frontend-ui-engineering`, `browser-testing-with-devtools`, `source-driven-development`, `vibe-e2e`.

### T27: Add optional Tauri silent printing

**Acceptance:** starts only after printer approval; desktop adapter prints only approved document types to configured Windows printer and surfaces recoverable errors.

**Verification:** signed test build plus physical printer evidence; no stock API is called by print retry.

**Dependencies:** T26 and explicit human approval.

**Likely files:** Tauri config, minimal Rust print adapter, frontend bridge and device evidence.

**Skills:** `source-driven-development`, `security-and-hardening`, `browser-testing-with-devtools`; dedicated Tauri-print skill if available then.

### T28: Final review and launch readiness

**Acceptance:** all approved scope passes tests/lint/build/E2E; migration recovery, secrets, logs, backup/restore, monitoring and rollback are documented; launch decision is GO or NO-GO with blockers.

**Verification:** `vibe-review`, `vibe-simplify`, `vibe-ship`; rerun full commands and approved device cases.

**Dependencies:** T19 plus every approved Phase 4 task.

**Likely files:** `tasks/test-result.md`, launch/rollback documentation and only fixes explicitly accepted from review.

**Skills:** `vibe-review`, `code-review-and-quality`, `security-and-hardening`, `performance-optimization`, `vibe-ship`.

## Phase Checkpoints

1. **Checkpoint A after T07:** access model and template foundation; human review/context reset.
2. **Checkpoint B after T14:** real stock can be received and traced; schema review/context reset.
3. **Checkpoint C after T19:** critical outbound MVP works; internal-release decision/context reset.
4. **Checkpoint D after T26:** extended web/PWA/device scope; decide whether Tauri is needed.
5. **Checkpoint E after T28:** GO/NO-GO and rollback readiness.

Do not start the next checkpoint's tasks in the same build session unless the human explicitly asks.

## Tradeoffs and Open Questions

- **Password hashing:** recommend Argon2id; fallback to Node `scrypt` if native dependency support is unacceptable. Decide before T04.
- **`admin_template/`:** recommend delete after T02/T05 prove `frontend/` is stable; keeping two copies causes drift.
- **Reservation TTL:** plan assumes 30 minutes before picking starts; picked stock never auto-expires.
- **TTL implementation:** expire lazily during list/claim/release requests in MVP; add a background cleanup job only if stale rows measurably accumulate.
- **Short shipment:** plan assumes `needs_repick`; only `outbound.resolveDiscrepancy` can approve short ship with reason.
- **Email:** use a mock/no-op provider through MVP; choose production provider before launch.
- **Offline:** out of scope. Every scan requires server acknowledgement; UI must show loss of connection clearly.
- **Tauri vs TypeScript-only:** Tauri printing requires a small Rust adapter, which conflicts with “TypeScript toàn bộ”. Keep T27 out unless the user explicitly approves this exception; Electron is not added merely to avoid Rust.
- **Performance starting budgets:** list APIs p95 < 500 ms on local representative data; scan acknowledgement p95 < 300 ms; revisit after T19 measurements.
