# Collaboration Lite

Optional coordination for a personal or small-project Work item. It adds a few bounded local workstreams; it does not change the Plane lifecycle, profiles, gates, or the five invariants.

## When to use it

Use only when a Coordinator needs to split one Work item into a small number of bounded tasks or ask for an independent cross-check. Without a task packet, use the normal single-Agent flow unchanged.

Create the first packet during planning. That opts the Work item into collaboration-lite locally, but does **not** change its Plane state. Dispatching a Worker is execution and happens only after the normal authorized `started` transition.

## Roles and authority

| Role | Does | Must not do |
|---|---|---|
| Coordinator | Creates packets, accepts an owner, compares evidence, and writes authorized Plane summaries | Substitute for the user or bypass Invariant 3 |
| Worker | Completes one packet and appends its result to `report.md` | Write Plane or expand the declared scope |
| Reviewer | Independently checks a Worker result and records a finding in `review.md` | Treat a finding as a vote or gate evidence |
| Third opinion | Compares conflicting evidence for a material disagreement or higher-risk change | Decide by majority vote |

Only the Coordinator writes Plane comments, bindings, descriptions, or state. This is an Invariant 3 authorization refinement, not a sixth invariant: every Plane write still needs its normal authorization, read-before-write, and read-back verification.

When available, prefer a Reviewer from a different model or provider for diversity of judgment. Run cross-checks sequentially. Provider/model information is advisory runtime context; record it in `review.md` or an Agent Brief coordination summary, never in a persistent config, binding, or packet contract.

## Workstream contract

One Work item has at most a few workstreams. A packet declares one owner session, bounded files or symbols, acceptance criteria, and optional dependencies. If two sessions request the same packet, the Coordinator records the first accepted owner and resolves the duplicate manually. There are no claims, leases, heartbeats, TTLs, or durable ledger.

Use these paths within the existing Execution Context root when Layer 2 is enabled:

```text
.agent-work/<work item>/workstreams/<workstream-id>/task-packet.md
.agent-work/<work item>/workstreams/<workstream-id>/report.md
.agent-work/<work item>/workstreams/<workstream-id>/review.md
```

`report.md` is append-only: append dated evidence instead of replacing prior conclusions. A Reviewer writes a separate `review.md` using the shared [finding template](../templates/finding.md). If the repository has `execution_context.mode: disabled`, collaboration-lite is unavailable for local dispatch; retain the single-Agent flow or enable the existing context feature through its normal configuration process.

Before an authorized Plane summary, the Coordinator compares the packet's scope and acceptance criteria with Worker and Reviewer evidence. Keep unresolved disagreement visible. Integration failure leaves the Work item in its existing `started` state; it neither creates nor rolls back a Plane state. Local workstream progress, a Reviewer agreement, or a third opinion never satisfies `review_gate` or `completion_gate`.

## Cross-check and disagreement

The packet's `independent_review_requested` field is a boolean. When false, the Coordinator decides whether a review is useful. Request a third opinion only when risk warrants it or disagreement is **material**: it changes the acceptance conclusion or crosses a packet's declared file/symbol boundary.

The Coordinator records the final rationale from the evidence. Do not count votes or auto-resolve a conflict. For an Execution Context revision/hash mismatch, report `observed context conflict` and do not auto-repair; follow [Execution Context](execution-context.md).

## Boundaries and recovery

Collaboration remains inside the Work item's resolved team/project boundary; never dispatch work across teams automatically. On resume, first follow the existing [evidence ladder](resume-work.md). If no packet exists, resume the single-Agent flow. If a packet exists, reconcile its reports with external Git/PR/CI evidence, which still wins.

## Deliberately deferred

This lightweight mode does not add configuration, schema, parsers, claims, TTLs, heartbeats, Coordinator leases, external transport, durable ledgers, or a new test suite. Revisit those only after a real concurrent multi-Worker need appears.
