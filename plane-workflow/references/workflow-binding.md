# Workflow Binding (Layer 1)

A Workflow Binding is a durable governance comment on one Plane work item. Use only the official Plane MCP calls discovered in this session.

| Step | Plane MCP call |
|---|---|
| Read item | `workitem(action="retrieve", project_id, workitem_id)` or `retrieve_by_identifier` |
| Read comments | `workitem_comment(action="list", project_id, workitem_id)` |
| Write binding | `workitem_comment(action="create", project_id, workitem_id, comment_html)` |
| Read-back | Fresh `workitem_comment(action="list", ...)` |

No retrieve/list/create capability means fail closed.

## Storage

Store this envelope in an internal HTML comment or HTML-safe preformatted block:

```text
---plane-workflow-binding---
schema_version: execution_binding_v1
workitem_uuid / workitem_identifier / project_id
profile / resolved_strategies / execution_context
configured_mode / context_decision
bound_at / payload_fingerprint
---end-plane-workflow-binding---
```

Serialize/parse with `scripts/binding-payload.mjs`. `workitem_uuid` is recorded only when Plane exposes an immutable UUID.

## Protocol

1. Retrieve the work item and verify `project_id`, identifier, and UUID when present.
2. Paginate comments; parse bindings and classify by immutable UUID (or by the comment's work-item scope when UUID is unavailable).
3. Before transitioning to started, validate and write the binding as a comment.
4. Read comments again and verify exactly one matching binding and its fingerprint.
5. Only then update state with `workitem(action="update", project_id, workitem_id, state=<state-id>)` and retrieve it again.

Duplicate, conflicting, failed, or unverifiable bindings stop the transition. Do not overwrite a conflict.
