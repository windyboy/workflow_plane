# Resume Work

Interrupted work → resume from **first stage lacking evidence**, not from scratch.

## Detection

1. Read latest **Agent Brief** — [agent-brief.md](agent-brief.md)
2. Check evidence in order:

| Evidence | Stage |
|---|---|
| Branch with work item ID | Branch established |
| Unpushed commits | Implementation |
| Linked PR | PR created |
| CI passing | CI passed |
| User acceptance | Acceptance |
| Deployment evidence | Production deployed |

## Rules

1. Skip stages with evidence; restart at first gap
2. No evidence → not complete
3. State matches evidence → don't re-write; lags → update to match
4. Report resume point; confirm with user

## Binding & Context (optional)

Protocol: [execution-context.md](execution-context.md) · Binding: [workflow-binding.md](workflow-binding.md)

- 0 bindings + legacy → legacy flow
- 0 bindings + context references binding → fail closed
- 1 binding → verify; mismatch → stop
- >1 bindings → user resolves

Context: discover by **work item UUID** (not display ID). Multiple candidates → user selects. Key changed → report stale ID; don't rename directory. Revision/hash conflict → don't write; report. Ghost branch / baseline drift → pause.

For collaboration-lite, reconcile local packet/report/review evidence after this ladder; see [collaboration.md](collaboration.md).

## Recovery (five questions)

1. **Goal?** — Intended deliverable
2. **Where am I?** — Evidence per stage; first gap
3. **What remains?** — Left to do
4. **What was learned?** — Constraints, decisions
5. **What was done?** — Steps + evidence

Git/PR/CI/deployment evidence beats local context. Local `completed` context ≠ Done.

## Scenarios

| Situation | Resume at |
|---|---|
| Branch + commits, no PR | PR creation |
| PR + CI, no acceptance | User acceptance |
| Merged, not deployed | Deployment → Done |
| Deployed, Plane not Done | mark-done |
