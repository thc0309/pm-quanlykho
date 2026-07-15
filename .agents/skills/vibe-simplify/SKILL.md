---
name: vibe-simplify
description: Simplify recently changed code for clarity and maintainability while preserving behavior and verification.
---

Use `code-simplification`.

Simplify the specified scope or recent changes:

1. Read `AGENTS.md` and local conventions.
2. Understand callers, behavior, edge cases, and tests before editing.
3. Look for deep nesting, long functions, nested ternaries, unclear names, duplication, and dead code.
4. Apply small simplifications incrementally.
5. Run tests after meaningful changes.
6. Verify build/typecheck when available.

If a simplification breaks tests, revert that specific simplification and choose a smaller one.
