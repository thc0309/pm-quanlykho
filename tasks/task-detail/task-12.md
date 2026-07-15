# T12: Build the stock ledger and balance core

## Acceptance

One transaction posts immutable movements and maintains/query balances by warehouse+location+product+lot/serial; negative stock is rejected; duplicate serial is rejected.

## Verification

Domain/integration tests cover receipt/issue math, rollback, lot/serial uniqueness and concurrent conflicting writes.

Evidence:

- 2026-07-15: stock API tests passed for receipt/issue balance math across none/lot/serial keys, rollback on negative-stock line, duplicate serial rejection, concurrent conflicting issue rejection and permission enforcement. Backend TypeScript build passed. Docker migration applied `007_stock_core.sql` and seed granted `stock.manage`.

## Dependencies

T08, T10.

## Likely Files

- `backend/db/migrations/007_stock_core.sql`
- `backend/src/domain/stock.ts`
- `backend/src/modules/stock.ts`
- `backend/test/stock.test.ts`

## Skills

- `test-driven-development`
- `api-and-interface-design`
- `security-and-hardening`
- `doubt-driven-development`
