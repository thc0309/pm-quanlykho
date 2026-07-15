# Token Optimization Reference

Use this file when planning agent workflow, trimming context, or debugging high token usage.

## Default Mode

- Keep `AGENTS.md` short and specific. Put long checklists here or in other `.agents/references/*` files.
- Load only files needed for the current phase. Prefer targeted snippets over full files.
- Keep status updates and final answers concise unless the user asks for detail.
- Stop at phase checkpoints instead of rolling spec, plan, build, and review into one long context.

## Phase Split

Use separate sessions or compacted context between phases when practical:

1. `spec`: understand the product and acceptance criteria.
2. `plan`: create small tasks and verification steps.
3. `build`: implement one task with focused context.
4. `review`: inspect the diff and verification evidence.
5. `ship/e2e`: validate launch or browser flows.

Each phase should carry only its own inputs and a short handoff summary.

## Tool Budget

- Prefer deterministic shell commands for deterministic data.
- Use MCP tools only when their reasoning value beats their schema/context cost.
- Enable or call only the tool family needed for the task.
- Avoid repeated tool calls that fetch the same data; cache results in workspace files when useful.
- For code discovery, prefer codebase-memory MCP first, then `rg` for docs/config/literals.

Why: large MCP toolsets can add tool names and JSON schemas to every model request. Keep the enabled/called set narrow, especially for repeat workflows.

## GitHub Data

When reviewing PRs or issues:

- Prefer `gh pr diff`, `gh pr view --json ...`, `gh api ...`, or predownloaded artifacts for data the agent always needs.
- Store large diffs, comments, or logs under a temporary workspace file and read slices from that file.
- Use GitHub MCP only for operations where structured app context or authenticated workflow integration is necessary.

## Context Handoff

At the end of each phase, record only:

- decision made,
- files changed or relevant,
- verification evidence,
- open risks,
- next task id.

## Sources

- GitHub Docs: https://docs.github.com/en/copilot/tutorials/optimize-ai-usage
- GitHub Blog: https://github.blog/ai-and-ml/github-copilot/improving-token-efficiency-in-github-agentic-workflows/
