# Work Phases

Canonical resolve flow (independent of Plane states):

```text
discover → solution → tasks → execute → verify
```

| Phase | Output | Reference |
|---|---|---|
| Discover | Work item + acceptance criteria | [workitem-discovery.md](workitem-discovery.md) |
| Solution | Approach, scope, risks, rollback | [start-implementation.md](start-implementation.md) |
| Tasks | Checkable task list | below |
| Execute | Code, commits, PR | [start-implementation.md](start-implementation.md) |
| Verify | Tests, CI, review, done | [move-to-review.md](move-to-review.md) · [mark-done.md](../mark-done.md) |

**Task format:**

```markdown
## Tasks
- [ ] T1: <what> — done when: <criteria>
```

Record in Agent Brief, work item comment, or `plan.md`. Sub-work items only when user requests.

For an optional small, bounded local split, see [collaboration.md](collaboration.md).

**Plane mapping:** discover/solution/tasks → `backlog`/`unstarted`; execute → `started`; verify → review → `completed`.

Handoff: [agent-brief.md](agent-brief.md) reflects phase + open tasks.
