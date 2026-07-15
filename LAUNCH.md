# Launch readiness and operations

This repository is ready for a controlled internal pilot. External production launch remains **NO-GO** until the device and infrastructure gates below are closed.

## Release gates

| Gate | Current evidence | Decision |
|---|---|---|
| Unit/integration tests, lint, typecheck and builds | Run from the repository root before release | Required |
| Database migrations | Forward-only migrations through `017_launch_hardening.sql` | Required |
| Dependency audit | Backend and frontend lockfiles; no high/critical findings on 2026-07-15 | Required |
| Android scanner and offline workflow | E2E-012 needs the intended physical Android model over HTTPS | Blocks external launch |
| Printed document and label output | E2E-013 needs the approved physical printer | Blocks external launch |
| Production platform | TLS, static hosting headers, encrypted backups and monitoring must be provisioned | Blocks external launch |

Tauri silent printing is not approved and is not part of the release. The browser system-print path is the only supported print path.

## Production configuration and secrets

- Set `NODE_ENV=production`, `PORT`, `DATABASE_URL` and a unique random `SESSION_SECRET` of at least 32 characters through the deployment secret store.
- Do not set seed passwords in the long-running production service. Run an explicitly controlled bootstrap job, rotate the temporary password immediately, then remove its environment values.
- Never copy values from `docker-compose.yml`; that file is development-only.
- Terminate TLS before the frontend and API. Redirect HTTP to HTTPS and enable HSTS at the edge after the production hostname is final.
- Serve the frontend with a CSP that permits only the deployed same-origin assets and API. Allow camera access only for the scanner page's origin; the API itself sends `Permissions-Policy: camera=()`.
- Keep the API same-origin behind the frontend gateway. If cross-origin deployment is introduced, add an explicit origin allowlist and credentialed CORS tests before release.

## Migration procedure and recovery

1. Put stock-changing jobs and users into maintenance/read-only mode.
2. Take and verify an encrypted database backup.
3. Preflight migration 017; this query must return no rows:

   ```sql
   SELECT source_document_id, count(*)
   FROM sales_documents
   WHERE kind = 'invoice' AND source_document_id IS NOT NULL
   GROUP BY source_document_id
   HAVING count(*) > 1;
   ```

4. Deploy the backend version that understands all existing and new columns.
5. Run `npm run db:migrate --prefix backend` once. Re-running is safe because applied migrations are recorded.
6. Verify `GET /health`, migration history and the reserve → pick → check → ship smoke path before restoring writes.

Migrations are additive and have no automatic down scripts. If a migration fails before commit, fix the cause and rerun. If validation after migration finds data corruption, stop writes and restore the full database backup; do not edit an applied migration or manually delete its history row.

## Backup and restore

- Use a least-privileged PostgreSQL backup identity and an encrypted destination. Supply credentials through `PGPASSFILE` or the platform secret store, not command arguments.
- Minimum schedule: daily full backup, retained for 30 days, plus WAL/point-in-time recovery where the platform supports it.
- Example logical backup: `pg_dump --format=custom --file=<encrypted-backup-path> <database-service-name>`.
- Restore into an isolated database first: `pg_restore --clean --if-exists --no-owner --dbname=<isolated-restore-db> <backup-path>`.
- Run migrations, tests against the restored database, inventory reconciliation and sampled document-to-movement tracing before promoting a restore.
- Perform and record a restore drill before external launch and at least quarterly afterward.

## Logs and monitoring

- Preserve the `x-request-id` response header through the gateway and include it in structured API logs.
- Never log session cookies, authorization headers, password bodies, database URLs, full exports or printed document contents.
- Alert on API 5xx rate, authentication 429 rate, PostgreSQL connection saturation, failed migrations, negative-balance attempts and reconciliation mismatches.
- Track p50/p95/p99 API latency, frontend JavaScript errors and Core Web Vitals. Hold rollout if p95 rises more than 20%; roll back if it rises more than 50% or error rate doubles.
- Monitor business invariants: `available = on_hand - committed`, shipped documents have balanced movements, transfers have equal source/destination quantity, and one invoice exists per order.

## Staged rollout

1. Deploy to staging and run the complete automated suite plus E2E-001–013.
2. Deploy the same artifacts internally with writes limited to the pilot warehouse.
3. Observe for 24 hours, reconcile inventory and review error/latency dashboards.
4. Complete Android and printer evidence, backup restore drill and production edge configuration.
5. Expand warehouse-by-warehouse. Stop at any data-integrity, security or reconciliation anomaly.

## Rollback plan

Trigger rollback on any stock imbalance, cross-warehouse access, new high/critical vulnerability, error rate above twice baseline, p95 latency above 150% of baseline, or unrecoverable scanner/print regression.

1. Disable stock-changing access at the gateway or put the affected warehouse in maintenance mode.
2. Capture request IDs, affected document IDs and the current database backup/WAL position without logging secrets.
3. Redeploy the previous tested application artifacts. Do not reverse additive migrations merely to roll back application code.
4. If data integrity changed, restore to an isolated database and reconcile before choosing point-in-time recovery or audited corrective documents.
5. Verify health, login, warehouse isolation and the full critical outbound flow. Re-enable writes gradually.

Recovery targets must be agreed with operations before external launch. Until then, use an internal-pilot target of RPO 24 hours and RTO 4 hours, and treat any tighter business requirement as an unresolved launch blocker.
