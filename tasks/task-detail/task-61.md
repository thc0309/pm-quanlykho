# T61: API client và type frontend cho thông số

## Goal

Thêm type/client frontend cho spec definitions, options và product spec values.

## Acceptance Criteria

- [x] `frontend/src/lib/api.ts` có type rõ cho `text`, `number`, `boolean`, `select`.
- [x] Client có method list/create/update/status definitions/options.
- [x] Product create/update/detail có spec values trong contract.
- [x] API base URL test vẫn pass.

## Verification

- [x] `npm test --prefix frontend -- --run src/lib/api.test.ts`
- [x] `npm run build --prefix frontend`

## Dependencies

- T60

## Likely Files

- `frontend/src/lib/api.ts`
- `frontend/src/lib/api.test.ts`

## Recommended Skills

- `vibe-build`
- `api-and-interface-design`
- `test-driven-development`
