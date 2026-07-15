# T23: Add stock count and approved adjustment

## Acceptance

Count freezes a scoped snapshot, records actual quantity and posts variance only after approval; confirmed records remain immutable. Stock count list screens follow the global list/form rule.

## Verification

Tests cover concurrent movement conflict, positive/negative variance and permission/audit.

## Dependencies

T12, T19.

## Likely Files

- Migration for stock count tables.
- One backend module/test under `stock-counts`.
- One frontend feature/test under `stock-counts`.

## Skills

- `doubt-driven-development`
- `security-and-hardening`
- `frontend-ui-engineering`
- `vibe-test`
