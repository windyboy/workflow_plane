# Mark Done

Mark a Plane work item complete only when all of these are true:

1. The user selected the work item and authorized the change.
2. You retrieved it and verified its `project_id`.
3. The work is released, confirmed by the user, or has reliable deployment evidence.
4. You resolved the selected project's completed-state ID.
5. You updated the item with that state ID and retrieved it again to verify.

A merged PR or passing CI alone is not enough.

If release evidence is missing, report the item as ready and ask the user whether it has been released; do not change its state.
