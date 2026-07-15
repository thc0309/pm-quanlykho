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

## Global UI Rule

- Áp dụng cho toàn bộ tính năng đã làm và sẽ làm.
- Screen dạng danh sách chỉ hiển thị danh sách, filter/pagination và toolbar action.
- Nút `Thêm` trên list screen điều hướng sang route form riêng; không nhúng form tạo/sửa trong list screen.
- Mỗi dòng trong danh sách có cột `Action` riêng dùng icon button có `aria-label`.
- Component đặc thù của một feature đặt trong `frontend/src/features/<feature>/components/`; component dùng chung từ hai feature trở lên mới đặt trong `frontend/src/components/`.

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

- T01: Make the backend baseline truthful — [tasks/task-detail/task-01.md](task-detail/task-01.md)
- T02: Stabilize the copied frontend template — [tasks/task-detail/task-02.md](task-detail/task-02.md)
- T03: Establish the HTTP contract boundary — [tasks/task-detail/task-03.md](task-detail/task-03.md)
- T04: Implement session authentication API — [tasks/task-detail/task-04.md](task-detail/task-04.md)
- T05: Deliver the login and forced-password UI — [tasks/task-detail/task-05.md](task-detail/task-05.md)
- T06: Enforce warehouse permissions in the API — [tasks/task-detail/task-06.md](task-detail/task-06.md)
- T07: Deliver warehouse user and role administration — [tasks/task-detail/task-07.md](task-detail/task-07.md)

### Checkpoint A — Access foundation

- All T01–T07 commands pass.
- Browser proves login, forced password change and picker/checker permission separation.
- Human reviews password hashing choice and whether `admin_template/` can now be deleted.
- Stop for review/context reset before inventory schema work.

**Review decision (2026-07-15):** approved to continue under the user's explicit uninterrupted-build instruction. Node `scrypt` parameters and session handling remain covered by authentication/security tests. `admin_template/` is retained because deletion was not required for the product path and would be destructive cleanup without measurable runtime benefit.

### Phase 2 — Master data and real stock

- T08: Deliver warehouse locations — [tasks/task-detail/task-08.md](task-detail/task-08.md)
- T09: Deliver the minimum catalog and unit slice — [tasks/task-detail/task-09.md](task-detail/task-09.md)
- T10: Deliver products and barcode lookup — [tasks/task-detail/task-10.md](task-detail/task-10.md)
- T11: Deliver partner management — [tasks/task-detail/task-11.md](task-detail/task-11.md)
- T12: Build the stock ledger and balance core — [tasks/task-detail/task-12.md](task-detail/task-12.md)
- T13: Deliver receiving with lot/serial — [tasks/task-detail/task-13.md](task-detail/task-13.md)
  - Evidence (2026-07-15): backend 37/37 tests; frontend 22/22 tests; backend/frontend builds pass; migration `008_receipts.sql` applied. Browser created and confirmed `E2E-RCV-T13`; PostgreSQL verified `on_hand=5`, one movement, expiry `2027-12-31`, and idempotent retry. Responsive widths 320/768/1024/1440 had no document overflow; browser console had no warnings/errors.
- T14: Deliver inventory and traceability views — [tasks/task-detail/task-14.md](task-detail/task-14.md)

### Checkpoint B — Stock foundation

- Receive none/lot/serial products and reconcile movement totals to inventory.
- Warehouse isolation, FEFO metadata and concurrent negative-stock checks pass.
- Review schema/recovery notes before adding reservation state.
- Stop for review/context reset.

### Phase 3 — Critical outbound MVP

- T15: Deliver outbound draft and reservation release — [tasks/task-detail/task-15.md](task-detail/task-15.md)
- T16: Deliver the picker workflow — [tasks/task-detail/task-16.md](task-detail/task-16.md)
- T17: Deliver independent checking and shipping — [tasks/task-detail/task-17.md](task-detail/task-17.md)
- T18: Deliver discrepancy, re-pick, cancellation and reassignment — [tasks/task-detail/task-18.md](task-detail/task-18.md)
- T19: Prove and harden the critical flow — [tasks/task-detail/task-19.md](task-detail/task-19.md)

### Checkpoint C — Outbound MVP

- Critical workflow passes with two real roles and mobile viewport evidence.
- `picked` leaves `on_hand` unchanged; `shipped` decrements exactly once.
- Human decides whether this MVP is released internally before extended modules.
- Stop for review/context reset.

### Phase 4 — Extended warehouse modules

- T20: Add purchase orders — [tasks/task-detail/task-20.md](task-detail/task-20.md)
- T21: Add quote, sales order and commercial invoice — [tasks/task-detail/task-21.md](task-detail/task-21.md)
- T22: Add customer and supplier returns — [tasks/task-detail/task-22.md](task-detail/task-22.md)
- T23: Add stock count and approved adjustment — [tasks/task-detail/task-23.md](task-detail/task-23.md)
- T24: Add two-sided warehouse transfer — [tasks/task-detail/task-24.md](task-detail/task-24.md)
- T25: Add dashboard, reports and bounded export — [tasks/task-detail/task-25.md](task-detail/task-25.md)
- T26: Add web print, labels and PWA device evidence — [tasks/task-detail/task-26.md](task-detail/task-26.md)
- T27: Add optional Tauri silent printing — [tasks/task-detail/task-27.md](task-detail/task-27.md)
- T28: Final review and launch readiness — [tasks/task-detail/task-28.md](task-detail/task-28.md)

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
