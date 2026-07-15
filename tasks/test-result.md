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
