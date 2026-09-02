# Work item Templates

**Creation:** `idea-feature.md` · `bug-report.md` · `refactor.md`

**Review output:** `change-review.md` · `release-review.md` · `finding.md` (nested in reviews)

**Coordination:** `task-packet.md` (local collaboration-lite workstream contract)

## Routing

| Request | Template |
|---|---|
| New capability | Idea / Feature |
| Broken behavior | Bug |
| Internal cleanup | Refactor |
| Review change | Change Review |
| Verify release | Release Review |
| Split a planned local workstream | Task Packet |

Routing logic: [template-system.md](../references/template-system.md)

Creation templates have no Execution Context fields. `task-packet.md` is intentionally different: it is a local file inside an enabled Execution Context, not a Plane creation template. See [collaboration.md](../references/collaboration.md).

7 templates/files total (3 creation + 2 review output + 1 shared finding format + 1 local coordination packet).
