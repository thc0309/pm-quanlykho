# Codex Orchestration Patterns

This reference explains how this template composes skills and Codex custom agents without wasting context or creating coordination noise.

## Layers

| Layer | Location | Job |
|-------|----------|-----|
| Project instructions | `AGENTS.md` | Durable repo rules and workflow mapping |
| Skills | `.agents/skills/*/SKILL.md` | Reusable task workflow with progressive disclosure |
| Custom agents | `.codex/agents/*.toml` | Specialized subagent profiles for explicit fan-out |
| Main session | current Codex thread | Requirements, decisions, synthesis, edits unless delegated |

## Pattern 1: Single Skill Workflow

Use this for most work.

```text
User asks for work -> main Codex session invokes one skill -> result
```

Examples:

- `$vibe-spec` creates or updates `SPEC.md`.
- `$vibe-plan` creates `tasks/plan.md` and `tasks/todo.md`.
- `$vibe-build T01` implements one task and verifies it.
- `$vibe-review` reviews the current diff.

Why this works:

- One context owns the decision.
- The skill supplies the workflow.
- No extra agent coordination cost.

## Pattern 2: Sequential Lifecycle

Use this for normal feature development.

```text
$vibe-spec -> $vibe-plan -> $vibe-build -> $vibe-test -> $vibe-review -> $vibe-ship
```

Rules:

- The user controls progression between phases.
- Do not auto-roll from one task to the next.
- Update `tasks/todo.md` and `tasks/plan.md` after task work.
- Re-read only the relevant task/spec sections at each phase.

## Pattern 3: Parallel Review Fan-Out

Use this when the investigations are independent and the change has production risk.

```text
main session
  |-- code-reviewer
  |-- security-auditor
  |-- test-engineer
  |
  -> synthesize GO/NO-GO + rollback plan
```

Best fit:

- Production-bound launch review.
- PR review where security, correctness, and coverage can be assessed independently.
- Large diff triage where each agent returns a concise report.

Rules:

- Spawn subagents only when the user explicitly asks for subagents or parallel agent work.
- Give each subagent one perspective and one output format.
- Wait for all requested agents before synthesizing.
- The main session merges results, resolves duplicates, and makes the final recommendation.
- Subagents do not spawn other subagents.

## Pattern 4: Read-Heavy Exploration

Use Codex built-in exploration or a lightweight subagent only when the repo is too large for the main session to inspect efficiently.

Good prompts:

```text
Spawn one explorer agent to map the auth flow. Return only the relevant files, entry points, data flow, and risks.
```

```text
Spawn two agents in parallel: one maps frontend state flow, one maps API endpoints. Wait for both and summarize overlap.
```

Keep exploration agents read-only in spirit. They should return distilled findings, not raw logs.

## Anti-Patterns

### Meta-Orchestrator

Do not create an agent whose only job is deciding which other agent to call. The user, `AGENTS.md`, and skills already provide routing.

### Persona Calls Persona

Do not let `code-reviewer` call `security-auditor`. A persona can recommend a deeper security pass, but the main session or user initiates it.

### Deep Fan-Out

Avoid nested subagent trees. They increase cost, latency, and result ambiguity.

### Slash Commands As Source Of Truth

Codex custom prompts are deprecated. In this template, reusable workflows live as repo-scoped skills under `.agents/skills`.

## Custom Agent Authoring

Project agents live in `.codex/agents/*.toml`.

Each file must define:

- `name`
- `description`
- `developer_instructions`

Optional fields include:

- `model`
- `model_reasoning_effort`
- `sandbox_mode`
- `nickname_candidates`

Keep custom agents narrow and opinionated. Put workflow steps in skills; put role, perspective, and output shape in agents.
