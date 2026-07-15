---
name: vibe-build
description: Implement one planned task incrementally with tests, verification, task status updates, and no automatic commit.
---

Use `incremental-implementation` and `test-driven-development`.

Invocation modes:

- `$vibe-build TXX`: implement only the requested task.
- `$vibe-build`: implement the next unchecked task in `tasks/todo.md`.
- `$vibe-build all`: implement every unchecked task in `tasks/todo.md` in dependency order without asking between tasks.

For `$vibe-build all`:

1. Read `tasks/todo.md`, `tasks/plan.md`, and only the relevant `SPEC.md` sections for the unchecked tasks.
2. Build tasks one at a time, following the normal per-task workflow below.
3. After each task, run its verification, update `tasks/todo.md`, and record evidence in `tasks/plan.md`.
4. Continue automatically to the next unchecked task when verification passes.
5. Stop only if a task is blocked, verification fails, requirements contradict the plan, a destructive/irreversible action is needed, or the user asks to stop.
6. Do not commit unless the user explicitly asked for commits.

For each task:

1. Identify the requested task or the next unchecked task in `tasks/todo.md`.
2. Read that task's acceptance criteria in `tasks/plan.md` plus relevant `SPEC.md` sections.
3. Load only the needed source context.
4. If the task touches user input, authentication, authorization, data storage, secrets, permissions, or external integrations, also use `security-and-hardening`.
5. Write a failing test for the expected behavior when practical.
6. Implement the minimum code to pass.
7. Run focused tests, then broader regression checks appropriate to the change.
8. Run the build or typecheck when the project provides one.
9. Mark the task complete in `tasks/todo.md` and update `tasks/plan.md` if scope changed.
10. Report changes and verification evidence.
11. Suggest a commit message, but do not commit unless the user explicitly asks.

If a step fails, use `debugging-and-error-recovery` and report the blocker with evidence.
