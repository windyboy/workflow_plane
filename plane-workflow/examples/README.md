# Profile Examples

| Situation | Profile | Example |
|---|---|---|
| Solo / 1–2 people | minimal | [minimal-project.md](minimal-project.md) |
| Small team | standard | [standard-team.md](standard-team.md) |
| Enterprise / regulated | strict | [strict-enterprise.md](strict-enterprise.md) |

## Comparison

| | minimal | standard | strict |
|---|---|---|---|
| Plan | Implicit | Risk-based | Explicit |
| Review | PR ready | PR ready | User acceptance |
| Done | Release confirmed | Release confirmed | Production deploy |
| Audit | None | Summary | Detailed |

Each example: config + typical flow. Customize via `overrides` — see [configuration.md](../configuration.md).

v0.2.0 ≈ `profile: strict`.
