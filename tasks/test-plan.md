# Test Plan: Hệ thống quản lý kho đa ngành

Status: draft v6 — bổ sung required markers, metadata, multi-line forms, avatar, granular permissions, shared create/edit routes và thông số sản phẩm

Use with `vibe-e2e`. Do not mark PASS without browser/runtime evidence in `tasks/test-result.md`.

## Execution Protocol

1. Start frontend, Hono API and isolated PostgreSQL test database.
2. Run each case with the listed real role/session; never bypass API permission checks.
3. Record URL, role, viewport/device, visible result, console/network result and screenshot path when available.
4. Record PASS, FAIL or BLOCKED in `tasks/test-result.md`.

## Critical Browser Suites

| ID | Preconditions | Steps | Expected result |
|---|---|---|---|
| E2E-001 Auth | Seeded master | Login; complete forced password change; logout; visit signup path | Session works; signup absent; protected route redirects after logout. |
| E2E-002 Roles | Warehouse admin | Create picker/checker roles and users; try denied UI and direct API actions | UI hides denied action; API returns `403`; audit exists. |
| E2E-003 Locations/products | Admin permissions | Create storage/staging/shipping locations, lot product and barcodes; scan lookup | Correct warehouse entity resolves; duplicate/cross-warehouse barcode is rejected. |
| E2E-004 Receipt | Product/location exist | Receive none/lot/serial stock; retry confirm | `on_hand` increases once; lot/serial trace is correct. |
| E2E-005 Reserve | Available stock and outbound permission | Create outbound; release twice; open inventory | Status `ready_to_pick`; `available` decreases, `on_hand` unchanged; retry is idempotent. |
| E2E-006 Picking | Picker and reserved outbound | Claim; scan wrong then correct shelf; scan wrong then correct item/lot; resume; confirm | Wrong scans blocked; progress resumes; status `picked`; `on_hand` unchanged. |
| E2E-007 Independent check/ship | Picked outbound, checker user | Checker claims, rescans staged goods and confirms shipment; retry confirm | Picker cannot self-check; status `shipped`; `on_hand` decreases exactly once. |
| E2E-008 Mismatch/re-pick | Picked outbound | Checker scans missing/wrong/extra item; send to re-pick; picker fixes; checker retries | Ship blocked until resolved; transition/audit are correct. |
| E2E-009 Supervisor short ship | Mismatch and supervisor permission | Approve short ship with/without reason | Missing reason rejected; approved quantity alone is shipped and audited. |
| E2E-010 Cancel/reassign/expiry | Reserved and picked documents | Let untouched reservation expire; reassign picker; cancel reserved; attempt cancel picked without return scan | Reserved hold releases; reassignment audited; picked hold remains until physical return scan. |
| E2E-011 Responsive/accessibility | E2E-001–010 data | Run core paths at 320/768/1024/1440 px using keyboard; inspect focus, labels and status | Core actions remain usable; no unexpected console errors; status is not color-only. |
| E2E-012 Scanner devices | Keyboard scanner and Android camera | Scan shelf/product/lot/serial rapidly; disconnect network during scan | One scan produces one acknowledgement; phản hồi âm thanh/rung is clear; offline mutation is blocked visibly. |
| E2E-013 Reports/print | Confirmed data | Filter/export report; print confirmed document/label; retry print | No warehouse leakage; export bounded; print does not mutate stock. |
| E2E-014 Tauri optional | Approved Windows printer | Configure printer; silent-print confirmed document; trigger printer error | Only configured printer is used; error recoverable; no duplicate stock call. |
| E2E-015 Required markers | Admin and stock forms | Open auth/admin/master-data/document forms; inspect required and optional labels at 320/768/1440 px | Every required field shows `(*)`; optional fields do not; labels are Vietnamese except terms like `SKU`, `barcode`, `ID`. |
| E2E-016 Metadata actions | Admin có permission granular tương ứng | Edit và deactivate/reactivate category, unit, location, product, partner; sửa role; xóa role chưa từng gán và thử xóa role đã gán | Rows update without reload; role chưa gán bị xóa; unsafe delete bị chặn với lỗi tiếng Việt; không còn disabled placeholder action. |
| E2E-017 Multi-line documents | Products/partners/stock exist | Create purchase order with two lines; create return with two lines; inspect submitted payload/effects | Both documents persist all lines; last line cannot be removed; totals/status reflect all lines. |
| E2E-018 User metadata/avatar | Warehouse admin | Create user with phone, employee code, department, job title and avatar image; edit metadata; reload list | Phone is required; avatar is resized and displayed; metadata persists and list shows avatar/phone/department/title. |
| E2E-019 Granular permissions | Master admin | Create role with only `catalog.categories.view/create`; use that user in UI and direct API calls | User can view/create categories only; update/deactivate/export/admin actions are hidden in UI and return `403` through API. |
| E2E-020 Shared create/edit routes | Admin có quyền create/update cho metadata | Open category, unit, location, product, partner, user and role list; click `Thêm` then `Sửa`; inspect URLs and form modes; retry with user thiếu `*.update` | `Thêm` uses `/create`, `Sửa` uses `/:id/edit`; both reuse the same form behavior; edit loads existing data; status actions stay row actions; user thiếu quyền không thấy action và direct API returns `403`. |
| E2E-021 Product specifications | Category and product permissions including `catalog.specs.*` | Create category laptop; add specs `RAM` select and `CPU` text; create product with spec values; reopen edit form; try invalid spec payload through UI/API; retry mutate specs without `catalog.specs.update` | Product form auto-renders specs by category; required/spec validation works; saved values persist; wrong type/category returns validation error; thiếu quyền ghi specs returns `403`. |

## API and Concurrency Coverage

- Zod validation, stable error envelope, bounded pagination/filter/sort and request IDs.
- Session expiry/revocation, warehouse isolation and every outbound permission.
- Reservation math: `available = on_hand - reserved - picked`.
- Concurrent release/pick/ship, stale version and repeated idempotency key.
- Wrong warehouse/location/product/lot/serial, duplicate serial, expired lot and FEFO override.
- State transition allowlist; client cannot patch status or quantities directly.
- Audit for assignment, override, discrepancy, cancellation, reversal, export and print.

## Evidence Gates

- Checkpoint A: E2E-001–002.
- Checkpoint B: E2E-003–004 plus inventory reconciliation.
- Checkpoint C: E2E-005–012; all are release blockers for outbound MVP.
- Checkpoint D: E2E-013 and E2E-014 only if Tauri is approved.
- Checkpoint G v4: E2E-015–019 for required markers, metadata actions, multi-line document forms, user metadata/avatar and granular permissions.
- Checkpoint K v6: E2E-020–021 for shared create/edit route rule and product specifications.
