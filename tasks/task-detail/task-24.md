# T24: Add two-sided warehouse transfer

## Acceptance

Transfer-out moves stock to in-transit; destination receipt moves it to target location; cancel/reversal cannot duplicate stock. Transfer list screens follow the global list/form rule.

## Verification

Tests reconcile source+transit+destination and enforce warehouse permissions.

## Dependencies

T12, T13, T19.

## Likely Files

- Migration for transfer tables.
- One backend module/test under `transfers`.
- One frontend feature/test under `transfers`.

## Skills

- `doubt-driven-development`
- `api-and-interface-design`
- `frontend-ui-engineering`
- `vibe-test`
