# T19: Prove and harden the critical flow

## Acceptance

Automated integration plus browser evidence proves receipt → reserve → pick → independent check → ship; duplicate/concurrent requests never double-decrement; API hot-path query/lock behavior is measured.

## Verification

- `npm test`
- `npm run lint`
- `npm run build`
- Execute E2E-001–E2E-010 from `tasks/test-plan.md`
- Record results in `tasks/test-result.md`

## Dependencies

T13–T18.

## Likely Files

- `backend/test/outbound-flow.test.ts`
- `frontend/src/features/outbound/outbound-flow.test.tsx`
- `tasks/test-result.md`

## Skills

- `vibe-test`
- `vibe-e2e`
- `browser-testing-with-devtools`
- `performance-optimization`
- `vibe-review`
