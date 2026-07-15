---
name: vibe-review
description: Review current changes across correctness, readability, architecture, security, and performance with file-line findings.
---

Use `code-review-and-quality`.

Review the current diff, staged changes, or user-specified files. Check:

1. Correctness: spec match, edge cases, tests.
2. Readability: names, control flow, organization.
3. Architecture: existing patterns, boundaries, abstraction level.
4. Security: validation, secrets, auth, data access.
5. Performance: N+1, unbounded work, unnecessary rendering, missing pagination.

Use `security-and-hardening` and `performance-optimization` when the diff touches those domains.

Return findings first, ordered by severity, with specific file:line references and fix recommendations.
