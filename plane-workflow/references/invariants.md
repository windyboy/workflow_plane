# Five Invariants

Apply to **all profiles**; they cannot be overridden by configuration or user instruction.

## 1. Read-Only → No Write
Inspect/analyze/explain/list/search means no Plane write. Ambiguous intent means ask. Every write is preceded by a fresh read.

## 2. Write-Back Verification
After every write, retrieve the work item again and confirm the expected state/value. Mismatch means report failure.

## 3. Authorization
No create, state change, or completion without user authorization. A candidate found by search is not authorization.

## 4. Project Boundary Fixed
Resolve and verify `project_id` before every work-item or comment write. A work item may only be written through its own project. Cross-project writes stop and are reported.

## 5. Reality Check
Done requires evidence satisfying `completion_gate`. A merged PR or passing CI alone is not deployment evidence.

## Violation Examples

| Scenario | Invariant | Fix |
|---|---:|---|
| “inspect ENG-42” triggers a write | 1 | Read only |
| Write has no read-back | 2 | Retrieve immediately |
| Create a work item unrequested | 3 | Confirm first |
| Update through a different project | 4 | Stop and resolve project |
| Done on PR merge only | 5 | Require release/deployment evidence |
