# Project Scope

A Plane **project is the required write boundary**. Resolve its immutable `project_id` from repository instructions, a work-item read, or explicit user input; never infer it from a directory name or identifier prefix.

| Situation | Action |
|---|---|
| Project clear | Use its `project_id` for every write; verify the work item belongs to it |
| Project unclear | Read-only; ask the user |
| User specifies another project | Echo the exception and require explicit confirmation before writing |
| Workspace-wide search | Read-only discovery is allowed; candidate selection is not write authorization |
| Release reconciliation | Auto-close only explicitly authorized work items in the resolved project |

Never pass a work-item ID obtained from one project into a write for another. Resolve workflow states with `state(action="list", project_id=...)`; state names are display labels, state IDs are write values.
