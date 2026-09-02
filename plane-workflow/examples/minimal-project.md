# Minimal Profile

**For:** solo / rapid iteration.

```yaml
version: 1
profile: minimal
```

## Flow: ABC-123 Add dark mode

| Step | Behavior |
|---|---|
| Create | User requests → work item created |
| Start | Plan (no escalation) → `started` → branch |
| Push | PR + CI → review (no audit comment) |
| Done | User confirms release → `completed` |

**Traits:** implicit plan, PR-ready review, no audit, no project check.

**Limits:** no compliance trail, no auto release coordination.

## Optional: a small cross-check

For a bounded task that benefits from a second opinion, first enable the existing Execution Context through its normal configuration process, then follow [collaboration-lite](../references/collaboration.md). A Worker appends `report.md`; a Reviewer may independently write `review.md`; the Coordinator compares both with the packet before any authorized Plane summary.
