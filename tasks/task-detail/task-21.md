# T21: Add quote, sales order and commercial invoice

## Acceptance

Quote/order creates an outbound document without changing stock; shipped data produces an immutable invoice snapshot. Sales/quote/invoice list screens follow the global list/form rule.

## Verification

API/UI tests cover totals, status transitions and snapshot immutability.

## Dependencies

T11, T17, T19.

## Likely Files

- Migration for sales tables.
- One backend module/test under `sales`.
- One frontend feature/test under `sales`.

## Skills

- `api-and-interface-design`
- `frontend-ui-engineering`
- `test-driven-development`
- `vibe-test`
