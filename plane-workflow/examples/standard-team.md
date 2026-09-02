# Standard Profile

**For:** small teams (3–5).

```yaml
version: 1
profile: standard
```

## Flow: ABC-123 Add user auth

| Step | Behavior |
|---|---|
| Create | Work item + summary audit |
| Start | Simple → auto-start; risky (DB) → confirm first |
| Push | PR + CI → review + summary audit |
| Done | User confirms release → `completed` + audit |

**Traits:** risk-based plan, summary audit, optional project check, release coordination on request.

**Limits:** no production-deploy gate by default, no auto multi-work item close.
