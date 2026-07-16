# AGENTS.md - Codex Runtime Rules

This repo is a Codex Vibe Coding template. Keep this file small because it is loaded often. Put long guidance in `.agents/references/` and read it only when the task needs it.

## Always

- Prefix shell commands with `rtk`.
- Prefer codebase-memory MCP for code discovery: `search_graph`/`search_code`, `trace_path`, `get_code_snippet`, `get_architecture`. Fall back to `rg`/file reads for docs, configs, literals, or insufficient graph results.
- Touch only files required by the requested phase or task.
- Verify with real evidence before claiming done.
- Do not commit unless the user explicitly asks.
- Use Vietnamese for all user-facing UI text, docs, specs, task notes and final user-facing copy. Keep English only for highly specific technical terms or domain codes where translating would reduce clarity, such as API, SKU, barcode, FEFO, HTTP, database, migration, role and permission.

## Token Budget Mode

- Default to concise updates and final answers.
- Read only the smallest relevant file slice. Do not scan the whole repo unless the task requires it.
- Do not load reference files, skill files, MCP tools, browser tools, or GitHub data unless they are needed for the current phase.
- Keep phases separate: `spec -> plan -> build -> review -> ship/e2e`. Prefer a new session or compacted context between phases.
- For GitHub data, prefer deterministic `gh` CLI output or predownloaded diff files over repeated MCP calls when MCP reasoning is not needed.
- When a task grows beyond the current phase, stop at the checkpoint and ask for the next phase.

## Source Of Truth

| File | Read when |
|------|-----------|
| `tasks/todo.md` | session start, task selection, after task completion |
| `SPEC.md` | feature/spec decisions and acceptance criteria |
| `tasks/plan.md` | requested task details, dependency order, verification |
| `tasks/test-plan.md` | browser or E2E execution |
| `tasks/memory/short-term.md` | session resume and current queue |
| `tasks/memory/long-term.md` | verified completed work and decisions |

Session start: read `tasks/memory/short-term.md`, glance at the `SPEC.md` status line if present, then wait for the user's request. Read long-term memory only when prior decisions or evidence are needed.

Task work: identify the requested task, read only that task's `tasks/plan.md` entry plus cited `SPEC.md` sections, use the matching skill, verify, update task status, then run `rtk npm run memory:update` before stopping.

## Skill Routing

| Intent | Skill |
|--------|-------|
| Vague requirements | `interview-me` |
| Refine rough idea | `idea-refine` |
| Create/update spec | `vibe-spec` |
| Break spec into tasks | `vibe-plan` |
| Build/fix/apply changes | `vibe-build` |
| Tests or bug regression | `vibe-test` |
| Review current changes | `vibe-review` |
| Simplify recent changes | `vibe-simplify` |
| Launch readiness | `vibe-ship` |
| Browser E2E | `vibe-e2e` |
| UI/frontend work | add `frontend-ui-engineering` and read `.agents/references/frontend-profile.md` |
| Backend/API work | add `api-and-interface-design`; add `security-and-hardening` for input, auth, data, secrets, permissions, or integrations |

Spec, plan, review, and E2E phases are read-only for product code unless the user explicitly asks for edits in that phase.

## References

Read only when relevant:

- `.agents/references/token-optimization.md` - context, MCP/tool, GitHub data, and phase-split rules.
- `.agents/references/orchestration-patterns.md` - custom agents and multi-agent review.
- `.agents/references/frontend-profile.md` - frontend stack, slice plan, acceptance checklist.
- `.agents/references/backend-profile.md` - backend/API stack, slice plan, acceptance checklist.
- `.agents/references/testing-patterns.md` - test design patterns.
- `.agents/references/security-checklist.md` - security review/hardening.
- `.agents/references/performance-checklist.md` - performance review.
- `.agents/references/accessibility-checklist.md` - UI accessibility review.

Subagents are used only when the user explicitly asks for subagents or parallel agent work.
