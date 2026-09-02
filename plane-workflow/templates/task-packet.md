# Task Packet

Use for one collaboration-lite workstream. It is a local coordination record, not a Plane work item-creation template. Lifecycle timing, contract, and authority rules: [collaboration.md](../references/collaboration.md).

```markdown
# <workstream-id>: <short task>

- Parent work item: ABC-123
- Role: worker | reviewer | third-opinion
- Owner session: <accepted owner or unassigned>
- Depends on: <workstream IDs or none>
- independent_review_requested: true | false

## Scope

- Files/symbols: <bounded list>
- Out of scope: <bounded exclusions>

## Acceptance criteria

- [ ] <verifiable outcome>

## Evidence to check

- <tests, links, commands, or artifacts>

## Report locations

- Worker report: `report.md`
- Reviewer finding: `review.md` (if requested or chosen by Coordinator)

## Disagreements / handoff notes

- None known.
```

The Worker appends evidence to `report.md`. The Reviewer uses [finding.md](finding.md) in a separate `review.md`. Model/provider identity is optional advisory context for `review.md` or an Agent Brief summary, not a packet field.
