# Capability Discovery

Before the first Plane operation in a session, inspect the MCP tool catalogue. The official Plane MCP surface uses resource tools and `action` values; do not assume legacy tool names.

| Need | Official Plane MCP call | Missing → |
|---|---|---|
| Resolve project | `project(action="list" or "retrieve")` | Restrict to reads; ask for project |
| Find/read work item | `workitem(action="search" / "retrieve_by_identifier" / "retrieve")` | Do not start or write it |
| List workflow states | `state(action="list", project_id=...)` | No state update |
| Create/update work item | `workitem(action="create" / "update", project_id=..., workitem_id=...)` | Draft only; do not claim success |
| Comments | `workitem_comment(action="list" / "create", project_id=..., workitem_id=...)` | Report comment failure separately |

For a status update, resolve the target state ID from the selected project's `state(action="list")` response, then call `workitem(action="update", project_id=..., workitem_id=..., state=<state-id>)`. Read the work item again after every write.

Authentication, permission, or timeout failure means no simulated write. After a timeout, retrieve the work item before retrying.
