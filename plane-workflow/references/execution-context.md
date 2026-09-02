# Execution Context & Binding

Optional Layer 2 (local) + Layer 1 (Plane). `scripts/` validates only. Binding procedure: [workflow-binding.md](workflow-binding.md).

| Layer | Storage | Role |
|---|---|---|
| **1 Binding** | Plane comment | Frozen governance (profile + 7 strategies + context mode) |
| **2 Context** | `.agent-work/` (`plan.md`, `findings.md`, `progress.md`) | Working memory only |

No sixth invariant. Local `completed` context ≠ Done evidence.

## Binding

Envelope: `---plane-workflow-binding---` … `---end-plane-workflow-binding---`

Fingerprint: `SHA-256(canonicalJSON(payload sans bound_at/fingerprint))` — integrity only.

| Count | Action |
|---|---|
| 0, new | Create before started; read back |
| 0, legacy | Legacy flow; no backfill |
| 0, context refs binding | Fail closed |
| 1 | Verify fingerprint; reuse or stop |
| >1 / mismatch | Fail closed; don't overwrite |

`auto`: record `context_decision: enabled|not_needed` once after plan.

## Context

`plan.md` frontmatter: `format`, `work item`, `context_status` (prepared/active/paused/abandoned/completed), `context_revision`, `plan_hash`.

Phases: `not_started` · `in_progress` · `completed` · `excepted` (≠ context_status).

Conflict: `context_revision` + hash mismatch → report `observed context conflict`; don't modify files.

`auto` triggers: multi-session, ≥3 phases, migration, user tracking request. One-file fix → `not_needed`.

Gitignore: `required`+unignored → fail closed; skill never edits `.gitignore`.

Resume: match by work item UUID; external evidence wins ([resume-work.md](resume-work.md)).

**Collaboration-lite:** an enabled Layer 2 context may hold a few local task packets and append-only workstream reports under `.agent-work/<work item>/workstreams/`. It adds no lifecycle state or governance field; see [collaboration.md](collaboration.md).

Redact secrets. `findings.md` cannot carry governance fields.
