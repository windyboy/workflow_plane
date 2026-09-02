# Multi-Project Scope

Load only for an explicit request spanning Plane projects. A project is always a fixed write boundary.

## Protocol

1. List the candidate work items read-only and show each identifier and project.
2. The user explicitly selects every project and work item to change.
3. For each selected item, retrieve it, verify its `project_id`, and resolve that project's workflow states.
4. Write using that same `project_id`; read back before reporting success.

Never reuse a state ID or work-item ID across projects. Release reconciliation may report cross-project candidates, but must not close them without the item-level authorization above.
