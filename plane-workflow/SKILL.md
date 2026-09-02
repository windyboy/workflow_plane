---
name: plane-workflow
description: "Lightweight Plane work-item workflow for personal projects. Use for Plane work items, planning, starting implementation, status updates, or marking work complete."
---

# Plane Workflow

A small, evidence-based workflow for one developer or a small project.

## Rules

1. **Read before write.** Retrieve the work item before changing it.
2. **Use the work item's project.** Resolve its `project_id`; never write it through another project.
3. **Use explicit instruction as authorization.** A user instruction that names a work item and requested action or status authorizes that one write. Ask only when the request, work item, or target state is ambiguous; a search result is not authorization.
4. **Read back writes.** Retrieve again after a create, update, or comment.
5. **Do not mark Done on merge alone.** Require user confirmation that the work is released, or reliable deployment evidence.

## Plane MCP

Use the official Plane MCP resource actions. Discover the available tools first; names may differ between MCP versions.

| Need | Typical call |
|---|---|
| Find work | `workitem(action="search", query=...)` |
| Read by ID | `workitem(action="retrieve_by_identifier", workitem_identifier="PROJ-12")` |
| List project states | `state(action="list", project_id=...)` |
| Create | `workitem(action="create", project_id=..., name=...)` |
| Change status | `workitem(action="update", project_id=..., workitem_id=..., state=<state-id>)` |
| Comment | `workitem_comment(action="create", project_id=..., workitem_id=..., comment_html=...)` |

State names are for display only. Resolve a state ID from the selected project's states before updating.

## Flow

1. **Discover** — search or read work items; read-only by default.
2. **Plan** — summarize the goal, affected files, approach, and checks. Ask for confirmation when scope is unclear or risky.
3. **Start** — retrieve the item and project states, select the project's started state, update it, then read it back.
4. **Implement** — make the change, run relevant checks, and report results honestly.
5. **Review** — a ready PR and passing checks mean only that the work is ready for review; never move it automatically. Move it only when the user explicitly requests Review and the selected project has exactly one Review candidate resolved from its states. If Review is missing or ambiguous, report readiness and the blocking reason without writing or creating a state.
6. **Done** — follow [mark-done.md](mark-done.md).

## Blocked or ambiguous work

If requirements are unclear, checks fail, an MCP operation fails, or the target state is missing or ambiguous, keep the current state. Report the blocking reason and the suggested next step; do not guess, create a state, or retry a timed-out write without reading the work item again.

## Optional cross-agent review

For a plan, task list, or completed change that would benefit from a second look, use one independent reviewer:

- **Primary agent** owns the plan, implementation, verification, and every Plane write.
- **Reviewer agent** is read-only: inspect the proposed plan, task, or change; return findings, risks, and a recommendation. It must not update Plane, create tasks, change status, or overwrite the primary agent's work.
- **Primary agent** records each finding as adopted or declined with a short reason in an authorized Plane work-item comment (then reads it back), or in the final report when no Plane item exists. Escalate a high-risk or unresolved disagreement to the user.

This is optional for simple changes. It is a documentation-level review protocol only: do not add task leases, execution context, release coordination, extra configuration, or automatic agent dispatch.

## Minimal templates

Use a template only when creating a work item:

- [Idea / feature](templates/idea-feature.md)
- [Bug](templates/bug-report.md)
- [Refactor](templates/refactor.md)

## Status groups

Plane state groups include `backlog`, `unstarted`, `started`, `completed`, and `cancelled`. A project can name its states however it wants; use the discovered state ID.
