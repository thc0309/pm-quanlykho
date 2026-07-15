# T18: Deliver discrepancy, re-pick, cancellation and reassignment

## Acceptance

Mismatch goes to `needs_repick`; supervisor can approve short ship with reason; unpicked cancellation releases reservation; picked cancellation requires return scan; assignment changes are audited. Exception/reassignment list screens follow the global list/form rule.

## Verification

Tests cover each state transition and forbid direct status edits; browser demonstrates re-pick, supervisor decision and return-to-stock cancellation.

## Dependencies

T16, T17.

## Likely Files

- `backend/src/domain/outbound-state.ts`
- `backend/src/modules/outbound-exceptions.ts`
- `backend/test/outbound-exceptions.test.ts`
- `frontend/src/features/outbound/OutboundExceptions.tsx`
- `frontend/src/features/outbound/OutboundExceptions.test.tsx`

## Skills

- `test-driven-development`
- `security-and-hardening`
- `doubt-driven-development`
- `frontend-ui-engineering`
- `vibe-test`
