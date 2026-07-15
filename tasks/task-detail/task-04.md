# T04: Implement session authentication API

## Acceptance

Seeded master can log in, change temporary password and log out; cookie is `httpOnly`/`sameSite` and production-secure; public signup is absent; session/token/password values are never returned or logged.

## Verification

Tests cover login success/failure, expired/revoked session, forced password change and missing signup route.

## Evidence

2026-07-15: auth tests passed 6/6 covering secure cookie flags, generic login failure, rate limiting, expired/revoked sessions, forced password change, logout and absent signup. Full backend suite passed 11/11; TypeScript build passed. Master seed requires runtime `MASTER_EMAIL`/`MASTER_PASSWORD` and stores only a scrypt hash.

## Dependencies

T03.

## Likely Files

- `backend/package.json`
- `backend/db/migrations/002_auth.sql`
- `backend/src/modules/auth.ts`
- `backend/src/domain/password.ts`
- `backend/test/auth.test.ts`

## Skills

- `security-and-hardening`
- `api-and-interface-design`
- `doubt-driven-development`
- `vibe-test`
