# Backend Profile Template

Use this when a task includes APIs, server routes, persistence, jobs, external integrations, auth, permissions, or module contracts.

## Stack Selection

Do not choose a backend stack by default. Record the selected runtime, framework, database, queue, and deployment target in `SPEC.md`.

Existing stack wins. New stack choices need a short reason in `SPEC.md` or an ADR when expensive to reverse.

## Acceptance Checklist

- Public API contract is documented with typed request and response shapes.
- Validation happens at system boundaries: HTTP input, webhooks, external API responses, env vars, file uploads.
- Error responses use one consistent shape and do not leak internals.
- Authn/authz and ownership checks are explicit for protected data.
- List endpoints have pagination, sorting limits, and bounded filters.
- Mutating operations define idempotency, conflict handling, and transaction boundaries when needed.
- Database migrations include rollback or recovery notes.
- External integrations have timeout, retry, backoff, and signature/secret handling rules.
- Observability covers structured logs, useful metrics, and safe error reporting.
- Performance budget is stated for hot paths: query count, response time, payload size, job duration, or memory ceiling.
- Tests cover contract, validation, authorization, persistence, and failure paths.

## Slice Plan

Use small backend slices:

1. Contract/schema first: route shape, types, OpenAPI/GraphQL/schema docs.
2. Service boundary and happy-path route.
3. Persistence or external integration behind an interface.
4. Validation, authz, error semantics, and security hardening.
5. Unit and integration tests.
6. Observability, docs, and regression checks.

## Interface Rules

- Prefer additive changes over breaking field changes.
- Keep one error format across endpoints.
- Validate third-party responses as untrusted data.
- Avoid creating generic service layers until 2-3 use cases need the abstraction.
- Keep internal interfaces narrow and named after domain behavior, not transport details.

## Verification Evidence

Record:

- contract examples or schema diff,
- focused test output,
- integration test or local request evidence,
- security and performance checks relevant to the changed path.
