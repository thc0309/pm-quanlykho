# T20: Add purchase orders

## Acceptance

Create/approve PO and receive partial/full quantities through T13; PO itself does not change stock. Purchase order list screens follow the global list/form rule.

## Verification

API/UI tests prove outstanding quantity, duplicate receipt protection and supplier scope.

## Dependencies

T11, T13, T19.

## Likely Files

- Migration for purchasing tables.
- One backend module/test under `purchasing`.
- One frontend feature/test under `purchasing`.

## Skills

- `api-and-interface-design`
- `frontend-ui-engineering`
- `vibe-test`
