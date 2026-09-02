# Template System

Select **one** template from `templates/` per request. Collect only planning/security/verification info; blank or `unknown` for optional fields.

## Routing

| Request | Template |
|---|---|
| New capability | Idea / Feature |
| Broken behavior | Bug Report |
| Internal improvement, same behavior | Refactor |
| Review change/PR/design | Change Review |
| Verify artifact/release | Release Review |

Files: `idea-feature.md`, `bug-report.md`, `refactor.md`, `change-review.md`, `release-review.md`. `finding.md` is nested in Change Review only. Refactor: no unintended API/behavior changes.

## Rules

- Template fill ≠ creation authorization — still confirm per [workitem-discovery.md](workitem-discovery.md)
- Composite requests → one primary template; track rest as related work items

Overview: [templates/README.md](../templates/README.md)
