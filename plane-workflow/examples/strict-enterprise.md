# Strict Profile

**For:** enterprise, multi-team, regulated.

```yaml
version: 1
profile: strict
```

## Flow: ABC-123 Payment processing

| Step | Behavior |
|---|---|
| Create | Work item + detailed audit (compliance notes) |
| Start | Plan → explicit user confirm → `started` + audit |
| Implement | PR + CI → request user acceptance |
| Review | User accepts → review + detailed audit |
| Release | Merge + team approval |
| Done | Production deploy evidence → `completed` + audit |

**Traits:** explicit plan, user-acceptance review, production-deploy gate, detailed audit, required project check, auto release reconciliation.

**Limits:** slower; more confirmations.

## Release Reconciliation

With `release_reconciliation: enabled`, marking one work item done can close related work items in the same release with coordinated audit comments.
