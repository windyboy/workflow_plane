# AGENTS.md

Any agent working in this project must follow these rules.

## Plane workflow policy

- For work involving a Plane work item, follow the `plane-workflow/` skill in this repository (the source of truth). The host runtime installs a generated copy at `.forge/skills/plane-workflow/` produced by `npm run sync:forge` from `plane-workflow/`; edit the repository source, never the generated copy.
- Never claim a work item state changed unless the Plane MCP write succeeded and a read-back verified it.
- Do not claim or start a work item unless the user explicitly selects it and confirms the work item understanding.
- Move a work item to a `started` state only after the planning and confirmation workflow has been completed (see `plane-workflow/SKILL.md` for Profile-specific requirements).
- Code completion or passing CI is not user verification. Move to In Review according to the active Review Gate policy (see `plane-workflow/configuration.md`): either when the user explicitly says they verified it, or when PR is ready and CI passes (depending on profile).
- Move a work item to `completed` according to the active Completion Gate policy (see `plane-workflow/configuration.md`): either after production deployment (strict), or after user-confirmed release (minimal/standard).
- Resolve workflow states from the work item’s project via `state(action="list", project_id=...)`. Use state IDs for writes and state groups for semantic decisions; never assume state names or IDs.
- If MCP is unavailable or any required operation fails, stop the state change and report the failure.
- Prefer commit messages containing a complete Plane identifier such as `ABC-123`; extract identifiers with a boundary-safe match.

## General principles

- The skill defines the procedure; this file defines non-negotiable constraints.
- When there is a conflict between this file and the skill, the **Five Non-Negotiable Invariants** (see `plane-workflow/references/invariants.md`) always take precedence.
- Profile and strategy configuration (see `plane-workflow/configuration.md`) determines gate policies and confirmation requirements, subject to these invariants.
