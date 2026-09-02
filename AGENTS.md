# Plane workflow policy

For Plane work, follow `plane-workflow/SKILL.md`.

- Read a work item before updating it, and read it again after the update.
- Verify its `project_id`; use that project for state and comment writes.
- An explicit instruction that names a work item and requested action or status authorizes that one write. Ask only when the request, work item, or target state is ambiguous.
- If requirements are unclear, checks fail, MCP fails, or a target state is missing or ambiguous, keep the current state and report the blocking reason plus next step.
- Do not claim a Plane write succeeded unless MCP returned success and a read-back verified it.
- Do not mark an item completed solely because a PR merged or CI passed; require user release confirmation or deployment evidence.
