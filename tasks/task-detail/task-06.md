# T06: Enforce warehouse permissions in the API

## Acceptance

Session determines warehouse and permissions; APIs can require `outbound.pick/check/ship/resolveDiscrepancy`; direct cross-warehouse and denied requests return `403`; protected changes create audit rows.

## Verification

Integration matrix covers `401/403`, master scope, warehouse isolation and audit actor/action/target.

## Evidence

2026-07-15: access tests passed 4/4 for unauthenticated, denied permission, cross-warehouse denial, master scope and immutable audit payload. Full backend suite passed 15/15 and TypeScript build passed. Permission codes support distinct pick/check/ship/discrepancy actions.

## Dependencies

T04.

## Likely Files

- `backend/db/migrations/003_permissions.sql`
- `backend/src/http/auth.ts`
- `backend/src/modules/access.ts`
- `backend/test/access.test.ts`

## Skills

- `security-and-hardening`
- `api-and-interface-design`
- `doubt-driven-development`
- `vibe-test`
