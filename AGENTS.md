# Plane workflow policy

For Plane work, follow `plane-workflow/SKILL.md`.

- Read a work item before updating it, and read it again after the update.
- Verify its `project_id`; use that project for state and comment writes.
- Ask before creating a work item or changing its status.
- Do not claim a Plane write succeeded unless MCP returned success and a read-back verified it.
- Do not mark an item completed solely because a PR merged or CI passed; require user release confirmation or deployment evidence.
