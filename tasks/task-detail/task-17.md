# T17: Deliver independent checking and shipping

## Acceptance

A different authorized user claims `picked`, rescans at staging and confirms shipment; one transaction validates version/reservation, creates movements, consumes reservation and decrements `on_hand` exactly once. Checker claim/resume list screens follow the global list/form rule; scan execution screens can remain workflow-focused.

## Verification

Tests cover same-user denial, wrong/short/extra scan, stale version, duplicate idempotency key and concurrent ship; mobile browser completes check/ship.

## Dependencies

T16.

## Likely Files

- `backend/db/migrations/011_checking.sql`
- `backend/src/modules/checking.ts`
- `backend/test/checking.test.ts`
- `frontend/src/features/checking/CheckingPage.tsx`
- `frontend/src/features/checking/CheckingPage.test.tsx`

## Skills

- `api-and-interface-design`
- `security-and-hardening`
- `doubt-driven-development`
- `frontend-ui-engineering`
- `vibe-test`
