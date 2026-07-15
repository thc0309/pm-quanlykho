# T01: Make the backend baseline truthful

## Acceptance

Health test is TypeScript; backend test/build commands pass; scripts do not advertise an unusable production start path.

## Verification

- `npm test --prefix backend`
- `npm run build --prefix backend`
- Request `GET /health` and verify the stable JSON envelope.

## Evidence

2026-07-15: `npm test --prefix backend` passed 1/1 TypeScript health test; `npm run build --prefix backend` passed. Removed the unusable emitted-file `start` script.

## Dependencies

None.

## Likely Files

- `backend/package.json`
- `backend/tsconfig.json`
- `backend/test/health.test.ts`
- `backend/test/health.test.mjs`
- `backend/src/app.ts`

## Skills

- `vibe-build`
- `vibe-test`
- `debugging-and-error-recovery` if sandbox/process errors recur.
