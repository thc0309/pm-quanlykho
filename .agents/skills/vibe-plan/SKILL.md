---
name: vibe-plan
description: Break SPEC.md into small verifiable tasks with acceptance criteria, dependency order, and verification steps.
---

Use `planning-and-task-breakdown`.

Read `SPEC.md` and the relevant codebase sections. Then:

1. Plan only; do not edit product code.
2. Run skill intake:
   - Inspect the repo shape, stack signals, `SPEC.md`, and likely work domains.
   - List applicable repo skills from `.agents/skills/*/SKILL.md`.
   - Map each planned phase/task to the skills it should use.
   - Identify missing useful skills as gaps with install/create recommendations.
   - Do not install, create, or modify skills during planning unless the user explicitly asks.
3. Identify dependency order between components.
4. Slice vertically so each task produces a verifiable path.
5. Include acceptance criteria, verification steps, likely files to touch, and recommended skills per task.
6. Add checkpoints between phases.
7. Present tradeoffs or open questions for human review.
8. For UI/browser work, add or update cases in `tasks/test-plan.md`.

Save the detailed plan to `tasks/plan.md` and the checklist to `tasks/todo.md`.

`tasks/plan.md` must include these sections:

- Skill Intake Summary: detected stack/work domains, applicable existing skills, and missing skill gaps.
- Task Plan: small ordered tasks with acceptance criteria, verification, likely files, dependencies, and recommended skills.
- Phase Checkpoints: stop points for human review and context reset.
