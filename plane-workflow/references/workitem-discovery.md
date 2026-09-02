# Work-item Discovery (Read-Only Default)

“What's left” and “show backlog” are browse-only requests. Determine project scope from explicit user input or repository policy; ask if it is unclear.

## Plane MCP operations

1. Search with `workitem(action="search", query=...)`, or list within the known project with `workitem(action="list", project_id=..., pql=...)`.
2. Retrieve an exact identifier with `workitem(action="retrieve_by_identifier", workitem_identifier="ENG-42")`.
3. Before any status change, retrieve the work item and list the selected project's states using `state(action="list", project_id=...)`.
4. Exclude `completed` and `cancelled` from active-work views; disclose any triage items instead of silently changing them.

Output discovered candidates as `Identifier | Title | Priority | State | Assignees | Project`; use `—` for missing data.

## Create

Echo the proposed name, project, impact, acceptance criteria, and metadata. Create only after explicit user confirmation with `workitem(action="create", project_id=..., name=...)`; then retrieve/read back the created work item. Templates never bypass the confirmation gate.
