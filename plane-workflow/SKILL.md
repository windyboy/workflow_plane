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
6. **Land new items outside started.** When creating, put the item in a non-`started` state resolved from `list_states` output, not from state names: use the project's `default` state if it belongs to the `backlog` or `unstarted` group; otherwise use the single state in the `backlog`/`unstarted` group; if that is still ambiguous, do not create — report the candidate states and ask. Exception: a single instruction that explicitly says create-and-start authorizes creating straight into a `started` state.
7. **Search before create.** Before creating a work item, search for an obvious same-target item (`search_work_items`). On a hit, pause creation, list the candidates, and let the user decide; a search result alone never authorizes a write, and keyword-only similarity with a different goal does not block creation.

## Plane MCP

Use the Plane MCP server's dedicated tools. Tool names can differ between MCP versions: enumerate the available `plane` tools before your first write, and never call a tool by an older name.

| Need | Typical call |
|---|---|
| Find work | `search_work_items(query=...)` |
| Read by ID | `retrieve_work_item_by_identifier(work_item_identifier="PROJ-12")` |
| List project states | `list_states(project_id=...)` |
| Create | `create_work_item(project_id=..., name=...)` |
| Change status | `update_work_item(project_id=..., work_item_id=..., state=<state-id>)` |
| Comment | `create_work_item_comment(project_id=..., work_item_id=..., comment_html=...)` |
| Add dependency | `create_work_item_relation(project_id=..., work_item_id=..., work_item_ids=[...], relation_type="blocked_by")` |
| Read dependencies | `list_work_item_relations(project_id=..., work_item_id=...)` |

Set `priority`, `labels`, or `estimate_point` on a create or update only when the selected project actually uses them or the user names them. Express dependencies as relations (`create_work_item_relation`), not as prose in a description. `relation_type` accepts `blocking`, `blocked_by`, `duplicate`, `relates_to`, `start_before`, `start_after`, `finish_before`, or `finish_after`.

Read-only helpers for read-back and trails: `list_work_item_comments(project_id=..., work_item_id=...)`, `list_work_item_activities(project_id=..., work_item_id=...)`, and `retrieve_work_item(project_id=..., work_item_id=..., expand=...)`.

Other tools (labels, assignees, archive, attachments, links, and page writes) exist on most servers; enumerate the available `plane` tools when you need them instead of assuming they are absent.

State names are for display only. Resolve a state ID from the selected project's states before updating.

## Flow

1. **Discover** — search or read work items; read-only by default. Before creating, follow Rules 6–7: resolve the landing state from `list_states`, and search first — pause and list candidates when an obvious same-target item exists.
2. **Plan** — summarize the goal, affected files, approach, and checks. Ask for confirmation when scope is unclear or risky.
3. **Start** — retrieve the item and project states, select the project's started state, update it, then read it back.
4. **Implement** — make the change, run relevant checks, and report results honestly.
5. **Review** — readiness means the work is ready for review; it never authorizes moving it. Evidence depends on the kind of change: for code, a PR open with its relevant checks passing; for docs, config, or data, implementation complete with verification proportional to risk. Move to a Review state only when the user explicitly requests Review and the selected project has exactly one Review candidate resolved from its states. If Review is missing or ambiguous, report readiness and the blocking reason without writing or creating a state.
6. **Done** — follow [mark-done.md](mark-done.md).

## Blocked or ambiguous work

If requirements are unclear, checks fail, an MCP operation fails, or the target state is missing or ambiguous, keep the current state. Report the blocking reason and the suggested next step; do not guess, create a state, or retry a timed-out write without reading the work item again.

## Manual cross-agent review

Run cross-agent review only when the user explicitly requests it. Do not trigger a reviewer automatically because a task is risky, a PR is ready, implementation finished, or the primary agent believes a second look would help. When manually requested, use one independent reviewer:

- **Primary agent** owns the plan, implementation, verification, and every Plane write.
- **Reviewer agent** is read-only: inspect the proposed plan, task, or change; return findings, risks, and a recommendation. It must not update Plane, create tasks, change status, or overwrite the primary agent's work.
- **Primary agent** records each finding as adopted or declined with a short reason in an authorized Plane work-item comment (then reads it back), or in the final report when no Plane item exists. Escalate a high-risk or unresolved disagreement to the user.

This is a user-triggered, documentation-level review protocol only. It does not block simple changes unless the user requests review; do not add task leases, execution context, release coordination, extra configuration, or automatic agent dispatch.

## Minimal templates

Use a template only when creating a work item:

- [Idea / feature](templates/idea-feature.md)
- [Bug](templates/bug-report.md)
- [Refactor](templates/refactor.md)

## Scope

Cycles, Modules, Views, Intake, and Pages planning and knowledge organization are outside this skill. When asked to plan or organize at that level, report and ask instead of silently planning. A user-named single write (for example, "put this plan on a page in project X") follows the normal rules: read before write, the item's project boundary, and read-back. Pages tools exist at project scope (`list_pages`, `retrieve_page`, `create_page`, `update_page_content`); on Plane CE, reading pages may additionally require session credentials (`PLANE_SESSION_*`), and a 404 from a read endpoint is a blocked operation to report, not a sign the page is empty. If the Pages API or any other feature is unavailable on the connected MCP version, treat it like any blocked operation — report the limitation and the next step; never silently degrade or claim a write succeeded.

## Status groups

Plane state groups include `backlog`, `unstarted`, `started`, `completed`, and `cancelled`. A project can name its states however it wants; use the discovered state ID.
