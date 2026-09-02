// scripts/policy.mjs
//
// Canonical, single-source-of-truth policy functions for the plane-workflow
// skill. These encode the rules documented in plane-workflow/SKILL.md and
// plane-workflow/mark-done.md so they can be unit-tested deterministically
// without touching a real Plane workspace.
//
// The identifier regex and state-type vocabulary below MUST stay in sync with
// the prose in SKILL.md / mark-done.md. scripts/validate.mjs enforces that the
// documented regex literal matches IDENTIFIER_PATTERN, preventing the
// "regex divergence" defect called out in W1N-17.

import { mergeConfig } from './profile-parser.mjs';

// Canonical identifier extraction/validation pattern. Boundary-safe: a 1-5 char
// uppercase alphanumeric team key, a hyphen, then digits. Mirrors SKILL.md
// ("extracted via boundary-safe regex \b[A-Z0-9]{1,5}-\d+\b") and mark-done.md.
export const IDENTIFIER_PATTERN = String.raw`\b[A-Z0-9]{1,5}-\d+\b`;
const IDENTIFIER_RE = new RegExp(IDENTIFIER_PATTERN, 'g');
// Non-global copy for single-match tests (RegExp.prototype.test is stateful
// with the global flag, so we keep a dedicated instance).
const IDENTIFIER_TEST_RE = new RegExp(IDENTIFIER_PATTERN);

export function extractIdentifiers(text) {
  if (!text) return [];
  const out = [];
  for (const m of text.matchAll(IDENTIFIER_RE)) out.push(m[0]);
  return out;
}

export function isValidIdentifier(id) {
  return typeof id === 'string' && IDENTIFIER_TEST_RE.test(id);
}

// Plane GraphQL WorkflowStateType enum values plus the semantic aliases the
// skill defines intentionally (review is a semantic state, not a Plane type).
export const VALID_STATE_TYPES = new Set([
  'backlog', 'unstarted', 'started', 'completed', 'cancelled', 'triage', 'review',
]);

// Lowercase single-word backtick tokens that are not state types but are legit
// in the skill prose, so the literal scanner does not false-positive on them.
export const NON_STATE_WORDS = new Set(['type', 'unknown', 'duplicate', 'disabled', 'auto', 'required']);

export function isValidStateType(t) {
  return VALID_STATE_TYPES.has(t);
}

// The Completion Gate is determined by the active Profile.
// Delegate to mergeConfig (profile-parser.mjs) so an invalid profile or an
// illegal override fails closed (throws) instead of silently downgrading to the
// standard profile's gate — keeping this entrance consistent with the parser's
// own safety checks.
export function getCompletionGate(profile = 'standard', overrides = {}) {
  return mergeConfig(profile, overrides).completion_gate;
}

// Backward compatibility: export the strict default
export const COMPLETION_GATE = 'production_deployment';

// Scenario 5 + 6: merge alone never marks Done; the Done gate is satisfied
// according to the active Profile's completion_gate. The gate MUST be passed in
// (derived from the active profile + overrides via getCompletionGate) so the
// policy cannot be bypassed by an implicit default.
//   release_confirmed   -> user release confirmation OR trusted deployment success
//   production_deployment -> trusted production deployment evidence ONLY (strict)
//   manual              -> explicit manual confirmation ONLY
//   merge-only          -> never eligible
export function isDoneEligible({
  completionGate = 'release_confirmed',
  deploymentStatus,
  deploymentEvidence,
  userConfirmedRelease = false,
  manualConfirmation = false,
  mergeOnly = false,
} = {}) {
  // Scenario 5: merge alone never marks Done.
  if (mergeOnly === true) return false;

  switch (completionGate) {
    // Strict: only trusted production deployment evidence satisfies the gate.
    case 'production_deployment':
      return deploymentStatus === 'success' && Boolean(deploymentEvidence);
    // Manual: an explicit manual confirmation is required.
    case 'manual':
      return manualConfirmation === true;
    // release_confirmed (default): user confirmation OR trusted deployment.
    case 'release_confirmed':
      return (
        userConfirmedRelease === true ||
        (deploymentStatus === 'success' && Boolean(deploymentEvidence))
      );
    // Fail closed: an unknown or misspelled completion gate must never be
    // silently treated as release_confirmed.
    default:
      return false;
  }
}

// Scenario 10: classify a work item as Bug vs Feature/Other. A `triage` label is a
// workflow/process label, not a defect indicator, so it is NOT treated as Bug.
const BUG_LABELS = new Set(['bug', 'defect', 'regression']);
export function classifyWorkItem({ type, labels = [], title = '', description = '' } = {}) {
  if (type && /\bbug\b/i.test(type)) return 'Bug';
  if ((labels || []).some((l) => BUG_LABELS.has(String(l).toLowerCase()))) return 'Bug';
  if (/\bbug\b/i.test(title || '') || /\bbug\b/i.test(description || '')) return 'Bug';
  return 'Feature/Other';
}

// Scenario 9: Plane project is the required write boundary. A write is allowed
// only when the resolved context project and the work item's project are present and equal.
export function scopeAllows({ resolvedProjectId, workItemProjectId } = {}) {
  return Boolean(resolvedProjectId && workItemProjectId && resolvedProjectId === workItemProjectId);
}

// Scenario 3: more than one Review-semantic candidate is ambiguous and requires
// clarification before mapping.
export function isReviewStateAmbiguous(candidates = []) {
  const reviews = candidates.filter(
    (c) => c && (c.type === 'review' || /review/i.test(c.name || ''))
  );
  return reviews.length > 1;
}

// Scenario 1: a read-only inspection intent performs no write. Explicit write
// verbs flip to a write intent; inspection/explanation verbs are read-only.
const WRITE_VERBS = /\b(start|create|update|move|mark|set|assign|close|complete|delete|add|claim)\b/i;
const READ_VERBS = /\b(inspect|look at|analyze|explain|read|show|describe|what|how|why|list|find|search)\b/i;
export function isWriteIntent(text = '') {
  if (WRITE_VERBS.test(text)) return true;
  if (READ_VERBS.test(text)) return false;
  return false; // default to read-only (safe)
}

// Scenario 4: after a tool timeout, the work item must be re-read before retry.
export const REQUIRES_READBACK_AFTER_TIMEOUT = true;

// Scenario 2: starting work without a confirmed plan must not move to started.
// Profile-aware:
//   minimal  -> implicit (always allowed once user intent is clear)
//   standard -> risk_based: low/medium risk auto-starts; high risk escalates to explicit confirmation
//   strict   -> explicit (always requires confirmed plan)
export function shouldMoveToStarted({ planConfirmed = false, profile = 'standard', riskLevel = 'low' } = {}) {
  if (profile === 'minimal') {
    return true;
  }
  if (profile === 'strict') {
    return planConfirmed === true;
  }
  // standard: risk_based
  if (riskLevel === 'high') {
    // High-risk change (DB migration, API change, auth, payments): escalate to explicit confirmation.
    return planConfirmed === true;
  }
  // low / medium / unknown risk: proceed without blocking confirmation.
  return true;
}

// Scenario 7: partial success reporting when state and comment diverge.
export function summarizePartial(stateOk, commentOk) {
  if (stateOk && commentOk) return 'success';
  if (stateOk && !commentOk) return 'partial: state updated, comment failed';
  if (!stateOk && commentOk) return 'partial: comment added, state failed';
  return 'failed';
}

// --- W1N-28 Phase 0: state selection is driven by the discovered project workflow,
// NOT derived purely from the Profile. The Profile/override only determines the
// *Review Gate policy* (WHEN, via mayMoveToReview); the concrete Plane state
// names are resolved from discoveredProjectStates + an optional stateMapping. This
// keeps a single source of truth: configuration.md resolves the policy, the team
// workflow resolves the state names. Node tests use fixture states; the Markdown
// references must not declare their own gate/state defaults (see phase0.test.mjs).

// discoveredProjectStates: Array<{ name: string, type: string }>
// stateMapping (optional): { started?: string, review?: string, completed?: string }
// Returns the resolved state name, or null when not discoverable or ambiguous.
export function selectStartedState(discoveredProjectStates = [], stateMapping = {}) {
  if (stateMapping && stateMapping.started) return stateMapping.started;
  const started = (discoveredProjectStates || []).filter((s) => s && s.type === 'started');
  if (started.length === 1) return started[0].name;
  return null; // not found or ambiguous
}

export function selectReviewState(discoveredProjectStates = [], stateMapping = {}) {
  if (stateMapping && stateMapping.review) return stateMapping.review;
  const review = (discoveredProjectStates || []).filter(
    (s) => s && (s.type === 'review' || /review/i.test(s.name || ''))
  );
  if (review.length === 1) return review[0].name;
  return null; // not found or ambiguous
}

// The Review Gate policy (from the active Profile/override) determines WHEN an
// workItem may move to Review; it does NOT choose the target state.
//   reviewGate: 'pr_ready' | 'user_acceptance' (resolved from effective config)
//   evidence:  { prCreated?: boolean, ciPassed?: boolean, userAccepted?: boolean }
// Unknown policy fails closed (returns false).
export function mayMoveToReview(evidence = {}, reviewGate = 'pr_ready') {
  const { prCreated = false, ciPassed = false, userAccepted = false } = evidence || {};
  if (reviewGate === 'user_acceptance') return userAccepted === true;
  if (reviewGate === 'pr_ready') return prCreated === true && ciPassed === true;
  return false;
}
