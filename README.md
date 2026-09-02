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

The Plane project is the write boundary. The skill retrieves the work item before changing it, uses the project's state IDs, and retrieves again after every write.

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
