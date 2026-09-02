# Agent Brief

Short, second-person Plane comment for the **next Agent session**. Complements work item state, audit comments, and optional Execution Context — does not replace them.

## Write

| Moment | Capture |
|---|---|
| Start | Goal, solution summary, task list, branch, constraints |
| Progress | Tasks done/remaining, changes, decisions, blockers |
| Pause / session end | Stage, done/next, evidence pointers |
| Review | Built, how to verify, gaps |
| Done | Outcome, release pointer, lessons |

Skip if unchanged since last brief.

## Read

On in-progress work items: find latest `---agent-brief---` … `---end-agent-brief---` comment; reconcile with Git/PR/CI (evidence wins). Combine with [resume-work.md](resume-work.md) five questions when resuming.

## Template

```markdown
---agent-brief---
## For the next agent

**You are picking up:** ABC-123 — Add dark mode toggle

**Where things stand:** Implementation in progress; branch created.

**Solution:** CSS variables + settings toggle (navbar rejected)

**Tasks:**
- [x] T1: theme.css variables — done
- [ ] T2: Header.tsx colors
- [ ] T3: Settings toggle + tests

**What already happened:**
- Branch `feature/ABC-123-dark-mode`, commits through `a1b2c3d`

**What you should know:**
- Don't touch `legacy-auth/` (DEF-456)

**Suggested next steps:**
1. Finish `Header.tsx` colors
2. Open PR when CI passes

**Evidence:** branch `feature/ABC-123-dark-mode` · PR none

### Coordination summary (optional)

- Workstreams: `ui` reported; `docs` awaiting review
- Cross-check: `ui` reviewed independently; no material disagreement
- Handoff: compare `report.md` and `review.md` with packet acceptance criteria
---end-agent-brief---
```

Use the optional coordination summary only for a collaboration-lite Work item; it reports local status and evidence, not authority. **Style:** second person, factual, scannable bullets. No governance fields (authorization, gates, profile).

## Idempotency

Append only; don't edit prior briefs. Skip duplicates. Redact secrets and personal paths before posting.

## vs Other Records

| Record | For |
|---|---|
| Agent Brief | Next Agent — what happened, what's next |
| audit_comments | Humans — state-transition audit |
| Execution Context | Local — plan/findings/progress files |
| Collaboration-lite packet/report/review | Local — bounded workstream evidence |
| Work item description | Everyone — requirements |
