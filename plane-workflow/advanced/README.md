# Advanced Features

Optional; load on demand or when profile enables them.

| Feature | When | File |
|---|---|---|
| Release reconciliation | `release_reconciliation: enabled` | [release-reconciliation.md](release-reconciliation.md) |
| Multi-project scope | Explicit cross-project request | [multi-project-scope.md](multi-project-scope.md) |

All five invariants still apply. Advanced features cannot weaken them.

**Performance:** reconciliation may scan commits; provide explicit work item IDs to skip inference.
