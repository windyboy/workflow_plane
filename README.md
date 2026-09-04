# Plane Workflow Skill

A lightweight Plane MCP skill for personal projects. It keeps the useful parts of a delivery workflow—clear plan, explicit status changes, verification, and honest completion—without team profiles, audit machinery, release reconciliation, or local execution-context files.

## What is included

```text
plane-workflow/
├── SKILL.md
├── mark-done.md
└── templates/
    ├── idea-feature.md
    ├── bug-report.md
    └── refactor.md
```

## Workflow

```text
Find or create a work item
→ Make a short plan
→ Start it in Plane
→ Implement and run checks
→ Optionally move it to Review
→ Confirm release or deployment
→ Mark it Done
```

The diagram is an overview; the authoritative lifecycle is the six-step Flow in `plane-workflow/SKILL.md` (Discover → Plan → Start → Implement → Review → Done), where Review and Done carry the strict semantics (readiness ≠ auto-move; release confirmation before Done).

The Plane project is the write boundary. The skill retrieves the work item before changing it, uses the project's state IDs, and retrieves again after every write.

## Humans decide, the skill executes

Best practices split by who acts on them:

- **You decide**: which project/module an item lives in, priority/labels (only if your project uses them), Backlog triage, whether work is ready for Review, and release confirmation before Done.
- **The skill executes the mechanics**: read-before-write and read-back, landing new items outside `started` (Rule 6), dedupe search before create (Rule 7), status moves and comments only on explicit instruction, and blocked reports instead of guessing.

A typical journey: you name a goal → the agent searches first (no duplicates) and creates a backlog item → you issue one Start instruction → the agent implements, runs checks, and reports → the agent reports readiness (code: PR + relevant checks; docs/config/data: implemented and verified) → you Review and confirm release → the agent marks Done. Weekly, you triage the Backlog and close stale items; the skill never self-organizes cycles, modules, views, or pages (see Scope in SKILL.md) and treats governance as human habits (below).

## More docs

- Plane project `workflow_plane` (WORKFLOWPL) pages: the refactor record, “Plane Best Practices & plane-workflow design rationale” (human-friendly rationale and best-practice mapping), and the “plane-workflow 使用速查” quick reference. Pages live in Plane (project scope); the repository keeps the canonical skill files.
- Installed skill copy used by agents: `~/.agents/skills/plane-workflow` (synced from this repo).

## Human-side governance (recommendations, not skill steps)

Keep the board healthy with habits, not automation — none of these are enforced by the skill:

- Triage the Backlog weekly: dedupe obvious duplicates and close stale items.
- If Cycles are enabled, at the end of a cycle explicitly move unfinished items out instead of quietly carrying them over.
- Treat estimates as a rough capacity baseline, never an exact commitment.

The skill deliberately stays lightweight: governance stays in Plane's UI/process and is not turned into automatic organization.

## Plane MCP setup

`.mcp.json` points at Plane Cloud’s OAuth endpoint:

```json
{
  "mcpServers": {
    "plane": {
      "type": "http",
      "url": "https://mcp.plane.so/http/mcp"
    }
  }
}
```

For authentication and self-hosted alternatives, see the [official Plane MCP documentation](https://developers.plane.so/dev-tools/mcp-server).
