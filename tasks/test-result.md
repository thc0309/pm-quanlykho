# Test Results

Use this file for `vibe-e2e` failures or blockers only. Passing evidence can stay in the task or final report unless the suite needs a durable history.

## Entry Template

### RESULT-001: Short Title

- Status: FAIL | BLOCKED
- Case ID:
- Date:
- Environment:
- Evidence:
- Expected:
- Actual:
- Recommended fix:

### RESULT-001: Re-pick queue is not resumable

- Status: FAIL
- Case ID: E2E-008
- Date: 2026-07-15
- Environment: local Hono + PostgreSQL, Chrome responsive session
- Evidence: mismatch action can set `needs_repick`, but `/api/picking` only lists `ready_to_pick/picking` and claim only accepts `ready_to_pick`.
- Expected: the assigned picker can resume a `needs_repick` document with reset scan progress.
- Actual: the document leaves both checker and picker queues.
- Recommended fix: return `needs_repick` to the picker queue, reset picked reservations/scans atomically, and allow claim/resume.
- Resolution: fixed in T19 hardening; browser rerun moved `E2E-OUT-T19-REPICK` from checker mismatch back to the picker queue with a claim action.

### RESULT-002: Physical Android scanner evidence unavailable

- Status: BLOCKED
- Case ID: E2E-012
- Date: 2026-07-15
- Environment: local Chrome responsive session; no attached Android camera device
- Evidence: keyboard burst `E2E-T26` produced one acknowledgement; the camera action reported the BarcodeDetector fallback; offline blocking has component regression coverage.
- Expected: scan shelf/product/lot/serial on a real Android camera and verify vibration plus offline behavior.
- Actual: no physical Android device or camera permission target is attached to this workspace.
- Recommended fix: run E2E-012 on the intended Android model over HTTPS before external release.

### RESULT-003: Physical print output unavailable

- Status: BLOCKED
- Case ID: E2E-013
- Date: 2026-07-15
- Environment: local Chrome responsive session; no configured physical printer
- Evidence: the confirmed receipt print layout rendered at 320/1440 px and opened Chrome's native system-print surface; unit coverage proves retry calls only `window.print()` and performs one GET with no stock mutation.
- Expected: inspect paper/PDF output for confirmed documents and product/lot/serial labels, then retry on the target printer.
- Actual: the browser automation cannot inspect native print output and no target printer is available.
- Recommended fix: execute print/reprint evidence on the approved printer before external release.

### RESULT-004: Optional Tauri printer approval absent

- Status: BLOCKED
- Case ID: E2E-014
- Date: 2026-07-15
- Environment: no approved Windows printer or signed desktop target
- Evidence: T27 requires explicit human printer approval before any Tauri implementation; none was provided.
- Expected: signed desktop build prints approved document types only to the configured printer and recovers from printer errors without stock calls.
- Actual: task intentionally skipped at its authorization gate; no silent-print capability was added.
- Recommended fix: open a new T27 task only after naming and approving the printer, document allowlist and deployment target.
