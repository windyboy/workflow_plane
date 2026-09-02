# Review Gate Policy

`review_gate` and `completion_gate` come from effective profile + overrides — not hardcoded here. The Completion Gate is profile-driven. Resolve via [configuration.md](../configuration.md) / `plane-workflow config diagnose`.

## Policies

| `review_gate` | Trigger | Default |
|---|---|---|
| `pr_ready` | PR + CI pass | `pr_ready` (default for `minimal` and `standard`) |
| `user_acceptance` | User confirms fix | `user_acceptance` (default for `strict`) |

| `completion_gate` | Trigger | Default |
|---|---|---|
| `release_confirmed` | User/release evidence | minimal, standard |
| `production_deployment` | Production evidence | strict |
| `manual` | Explicit user only | override |

## Priority

1. Config overrides
2. Profile defaults
3. Repo instructions (AGENTS.md)
4. User session choice

Conflict → ask user. Always read effective config; never assume.

## Unchanged Rules

- Done requires evidence for resolved `completion_gate`
- No stage skip without evidence — [resume-work.md](resume-work.md)
- State writes need read-back

Declare in AGENTS.md: `review_gate: pr_ready` or work item description: `Workflow: review_gate=pr_ready`
