# Plane workflow policy

For Plane work, follow `plane-workflow/SKILL.md`.

- Read a work item before updating it, and read it again after the update.
- Verify its `project_id`; use that project for state and comment writes.
- An explicit instruction that names a work item and requested action or status authorizes that one write. Ask only when the request, work item, or target state is ambiguous.
- If requirements are unclear, checks fail, MCP fails, or a target state is missing or ambiguous, keep the current state and report the blocking reason plus next step.
- For optional cross-agent review, the primary agent is the only Plane writer and owns implementation plus verification.
- A reviewer agent is read-only: it may inspect plans, tasks, or changes and report findings, but must not write Plane, create tasks, change status, or overwrite work. The primary agent records each finding as adopted or declined with a reason in an authorized, read-back Plane comment, or in the final report when no Plane item exists.
- Do not claim a Plane write succeeded unless MCP returned success and a read-back verified it.
- Do not mark an item completed solely because a PR merged or CI passed; require user release confirmation or deployment evidence.
