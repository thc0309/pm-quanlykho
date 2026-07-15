# T03: Establish the HTTP contract boundary

## Acceptance

Hono has one error shape, request validation helper, request ID and bounded pagination parser; invalid input never leaks internals.

## Verification

Contract tests cover `404`, malformed query, pagination bounds and unexpected error; backend build/test pass.

## Evidence

2026-07-15: `http-contract.test.ts` passed 4/4; full backend suite passed 5/5 and TypeScript build passed. Boundary now provides request IDs, stable errors, JSON validation and pagination capped at 100 rows.

## Dependencies

T01.

## Likely Files

- `backend/src/app.ts`
- `backend/src/http/errors.ts`
- `backend/src/http/validation.ts`
- `backend/test/http-contract.test.ts`

## Skills

- `api-and-interface-design`
- `security-and-hardening`
- `vibe-test`
