# T05: Deliver the login and forced-password UI

## Acceptance

Real API-backed login/change-password/logout replaces template auth demo; loading/errors/disabled states work; signup is inaccessible.

## Verification

Component tests for form behavior; browser check at 320/768/1024/1440 px with keyboard and no console errors.

## Evidence

2026-07-15: Auth component tests passed 3/3; frontend lint/build passed and npm audit reported 0 vulnerabilities. Browser verified 320/768/1024/1440 without horizontal overflow, logical Email → Password → Login focus order, accessible labels and zero console warnings/errors. Removing unused Swiper/template routes reduced production JS from ~1.95 MB to 235 KB.

## Dependencies

T02, T04.

## Likely Files

- `frontend/package.json`
- `frontend/src/App.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/features/auth/AuthPage.tsx`
- `frontend/src/features/auth/AuthPage.test.tsx`

## Skills

- `frontend-ui-engineering`
- `vibe-test`
- `browser-testing-with-devtools`
