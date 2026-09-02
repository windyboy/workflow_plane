# Configuration

Optional `plane-workflow.config.yaml` in project root. Default profile: `standard`.

```yaml
version: 1
profile: standard
# overrides:
#   review_gate: user_acceptance
```

Diagnose: `plane-workflow config diagnose`

## Profiles

| | minimal | standard | strict |
|---|---|---|---|
| **For** | Solo / 1–2 people | Small teams | Enterprise / regulated |
| `plan_confirmation` | implicit | risk_based | explicit |
| `review_gate` | pr_ready | pr_ready | user_acceptance |
| `completion_gate` | release_confirmed | release_confirmed | production_deployment |
| `audit_comments` | none | summary | detailed |
| `release_reconciliation` | disabled | on_request | enabled |
| `output_verbosity` | minimal | standard | detailed |

## Strategy Items

| Item | Values |
|---|---|
| `plan_confirmation` | `implicit` · `risk_based` · `explicit` |
| `review_gate` | `pr_ready` · `user_acceptance` |
| `completion_gate` | `release_confirmed` · `production_deployment` · `manual` |
| `audit_comments` | `none` · `summary` · `detailed` |
| `release_reconciliation` | `disabled` · `on_request` · `enabled` |
| `output_verbosity` | `minimal` · `standard` · `detailed` |

## Forbidden Combinations

- `minimal` + `completion_gate: production_deployment`
- `completion_gate: merge` (violates Invariant 5)
- `production_deployment` + `plan_confirmation: implicit`
- `minimal` + `audit_comments: detailed`

Full rules: [references/configuration-schema.md](references/configuration-schema.md)

## Execution Context (optional)

```yaml
execution_context:
  mode: auto          # disabled | auto | required (default: disabled)
  root: .agent-work   # must be gitignored; skill never edits .gitignore
  format: execution_context_v1
```

- `disabled` — no local files; Layer 1 Binding still created for new work items
- `auto` — decide once after plan (multi-session, ≥3 phases, migration, user request → enabled)
- `required` — always create context; unignored root → fail closed

Protocol: [references/execution-context.md](references/execution-context.md)

## Common Overrides

```yaml
# Standard + production deployment gate
profile: standard
overrides:
  completion_gate: production_deployment

# Minimal + audit trail
profile: minimal
overrides:
  audit_comments: summary
```

## Troubleshooting

| Problem | Check |
|---|---|
| Config rejected | Forbidden combination? Use `config diagnose` |
| Not applied | File name, location, YAML syntax |
| Unexpected behavior | Effective config, project scope, overrides spelling |

Details: [references/configuration-schema.md](references/configuration-schema.md) · [SKILL.md](SKILL.md)
