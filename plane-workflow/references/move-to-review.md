# Move to Review

Resolve `review_gate` from effective profile (config → repo instructions → user choice → profile default). See [review-gate-policy.md](review-gate-policy.md).

Defaults: `pr_ready` (minimal/standard), `user_acceptance` (strict).

## `user_acceptance`

After summarizing commit/PR/CI, request acceptance. User says not fixed → stay in started; continue fixing. Only explicit acceptance triggers review move.

## `pr_ready`

PR created + CI passes → may move to Review. Inform user: acceptance happens during human review.

## Common Steps

1. Re-read work item; resolve `review_state`
2. Already in review → skip state write; dedupe audit comment
3. Update state; read back
4. Resolution comment: summary, root cause, implementation, key files, validation done/not done, limitations, PR/commit ref
5. Post **Agent Brief** — [agent-brief.md](agent-brief.md)
6. State ok + comment failed → report separately

## Execution Context (optional)

If `plan.md` exists: align scope, validation, risks, PR/CI with phases before review move. No context → skip. Independent of `audit_comments`.

After merge, stay in Review until real release/deployment.
