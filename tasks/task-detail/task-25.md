# T25: Add dashboard, reports and bounded export

## Acceptance

Inventory/expiry/movement summaries use scoped paginated queries; CSV export obeys filters/permissions and has a row limit. Dashboard/report list screens follow the global list/form rule where they render row-based lists.

## Verification

Query tests across warehouses; browser loading/empty/error/filter/export; measure representative response time and query plan.

## Dependencies

T20–T24.

## Likely Files

- One backend report module/test.
- One frontend report feature/test.
- Dashboard page.

## Skills

- `performance-optimization`
- `security-and-hardening`
- `frontend-ui-engineering`
- `vibe-test`
