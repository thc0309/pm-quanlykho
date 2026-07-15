# T02: Stabilize the copied frontend template

## Acceptance

Current template lint/build pass; known `any`/CommonJS lint errors are removed; no business feature is added.

## Verification

- `npm run lint --prefix frontend`
- `npm run build --prefix frontend`

## Evidence

2026-07-15: frontend lint passed with 0 errors (2 existing Fast Refresh warnings); production build passed. Removed explicit `any` and CommonJS type import errors.

## Dependencies

None.

## Likely Files

- `frontend/src/components/ecommerce/CountryMap.tsx`
- `frontend/src/pages/Calendar.tsx`
- `frontend/src/svg.d.ts`
- `frontend/eslint.config.js` only if required.

## Skills

- `vibe-build`
- `frontend-ui-engineering`
- `debugging-and-error-recovery`
