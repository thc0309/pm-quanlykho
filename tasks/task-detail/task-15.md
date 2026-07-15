# T15: Deliver outbound draft and reservation release

## Acceptance

Authorized user creates an outbound document and releases it to `ready_to_pick`; reservation uses FEFO stock key, reduces `available` but not `on_hand`, expires after 30 minutes if untouched and is idempotent. Outbound document list screens follow the global list/form rule.

## Verification

Tests cover insufficient stock, concurrent releases, retry, expiry and `on_hand/available`; browser creates/releases a document.

## Dependencies

T11, T12, T14.

## Likely Files

- `backend/db/migrations/009_outbound_reservations.sql`
- `backend/src/modules/outbound.ts`
- `backend/test/outbound-release.test.ts`
- `frontend/src/features/outbound/OutboundPage.tsx`
- `frontend/src/features/outbound/OutboundPage.test.tsx`

## Skills

- `api-and-interface-design`
- `security-and-hardening`
- `doubt-driven-development`
- `frontend-ui-engineering`
- `vibe-test`
