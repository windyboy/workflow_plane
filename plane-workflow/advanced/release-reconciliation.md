# Release Reconciliation

Auto-close work items from release scope. Load when `release_reconciliation: enabled` or explicitly requested.

## Inference

From `previous_release_ref` / `current_release_ref` / `release_commit` / `release_version`:

1. Collect commits in scope
2. Extract IDs via `\b[A-Z0-9]{1,5}-\d+\b`
3. **Strong** (commit/branch/PR/Plane link) → candidate
4. **Weak** (semantic match) → needs confirmation
5. Authorize before any write

## Reverts

Detect `revert:` patterns. Don't auto-complete on revert alone. Reconsider only when fix restored and deployed.

## Batch

Per work item: read before write; skip if already done; timeout → re-read before retry. Partial failure: report state/comment separately. One failure doesn't block others.

## Report

| Work item | Title | States | Results | Evidence | Notes |

Failures use [output-contracts.md](../references/output-contracts.md) format.
