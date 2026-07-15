---
name: vibe-test
description: Run a TDD workflow or bug regression workflow: failing test first, implementation, passing verification, and regression checks.
---

Use `test-driven-development`.

For new features:

1. Write tests describing expected behavior and confirm they fail when feasible.
2. Implement the code to pass.
3. Refactor only while tests stay green.

For bug fixes, use the Prove-It pattern:

1. Write a test that reproduces the bug.
2. Confirm the test fails.
3. Implement the fix.
4. Confirm the test passes.
5. Run broader regression checks.

For browser issues, also use `browser-testing-with-devtools` or the available Codex browser/Playwright tooling.
