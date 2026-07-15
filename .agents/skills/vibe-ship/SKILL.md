---
name: vibe-ship
description: Run pre-launch review, optionally with parallel Codex custom agents, then synthesize a GO or NO-GO decision with rollback plan.
---

Use `shipping-and-launch`.

For production-bound changes, ask Codex to spawn these project custom agents in parallel when the user has explicitly approved subagent work:

1. `code-reviewer`: five-axis review.
2. `security-auditor`: vulnerability and threat-model pass.
3. `test-engineer`: coverage and verification gap analysis.

If subagents are not requested or available, run the checks in the main session and clearly say that no subagents were spawned.

Synthesize:

1. Code quality blockers.
2. Security blockers.
3. Performance and accessibility risks.
4. Infrastructure readiness: env vars, migrations, monitoring, feature flags.
5. Documentation readiness.

Output:

```markdown
## Ship Decision: GO | NO-GO

### Blockers
- [Finding + file:line]

### Recommended Fixes
- [Finding + file:line]

### Acknowledged Risks
- [Risk + mitigation]

### Rollback Plan
- Trigger conditions:
- Procedure:
- Recovery target:
```

If any Critical finding exists, default to NO-GO unless the user explicitly accepts the risk.
