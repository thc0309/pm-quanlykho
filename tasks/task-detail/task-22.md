# T22: Add customer and supplier returns

## Acceptance

Returns reference original documents, validate quantity/lot/serial and post the correct immutable movement once. Return list screens follow the global list/form rule.

## Verification

API/UI tests cover over-return, duplicate confirm and traceability.

## Dependencies

T13, T17, T21.

## Likely Files

- Migration for return tables.
- One backend module/test under `returns`.
- One frontend feature/test under `returns`.

## Skills

- `doubt-driven-development`
- `api-and-interface-design`
- `frontend-ui-engineering`
- `vibe-test`
