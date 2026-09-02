#!/usr/bin/env node
// scripts/behavior.test.mjs
//
// Deterministic behavior-scenario tests for the plane-workflow skill.
// These encode the skill's documented decision rules as pure functions and
// assert the 10 scenarios from W1N-17. They require NO Plane workspace and
// perform NO writes.
import {
  extractIdentifiers,
  isValidIdentifier,
  isDoneEligible,
  classifyWorkItem,
  scopeAllows,
  isReviewStateAmbiguous,
  isWriteIntent,
  REQUIRES_READBACK_AFTER_TIMEOUT,
  shouldMoveToStarted,
  summarizePartial,
  getCompletionGate,
} from './policy.mjs';

const scenarios = [];
function scenario(name, fn) {
  scenarios.push({ name, fn });
}

function assertDeepEqual(a, b) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error('expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a));
  }
}

// 1. "Inspect ABC-123" performs no write.
scenario('Inspect ABC-123 performs no write', () => {
  if (isWriteIntent('Inspect ABC-123 and explain the lifecycle') !== false) {
    throw new Error('inspection intent was treated as a write');
  }
});

// 2. Starting work without a confirmed plan does not move to started (high-risk standard).
scenario('Starting work without a confirmed plan does not move to started', () => {
  // standard + high risk without confirmation => blocked
  if (shouldMoveToStarted({ planConfirmed: false, profile: 'standard', riskLevel: 'high' }) !== false) {
    throw new Error('high-risk standard change moved to started without confirmation');
  }
  // standard + high risk with confirmation => allowed
  if (shouldMoveToStarted({ planConfirmed: true, profile: 'standard', riskLevel: 'high' }) !== true) {
    throw new Error('high-risk standard change blocked after confirmation');
  }
  // standard + low risk auto-starts (risk-based)
  if (shouldMoveToStarted({ planConfirmed: false, profile: 'standard', riskLevel: 'low' }) !== true) {
    throw new Error('low-risk standard change required confirmation');
  }
});

// 2b. Standard (risk_based) auto-starts low/medium risk but escalates high risk.
scenario('Standard profile is risk-based, not always explicit', () => {
  if (shouldMoveToStarted({ profile: 'standard', riskLevel: 'low' }) !== true) {
    throw new Error('low-risk standard change required confirmation');
  }
  if (shouldMoveToStarted({ profile: 'standard', riskLevel: 'medium' }) !== true) {
    throw new Error('medium-risk standard change required confirmation');
  }
  if (shouldMoveToStarted({ profile: 'standard', riskLevel: 'high' }) !== false) {
    throw new Error('high-risk standard change auto-started without confirmation');
  }
  if (shouldMoveToStarted({ profile: 'standard', riskLevel: 'high', planConfirmed: true }) !== true) {
    throw new Error('high-risk standard change blocked after confirmation');
  }
  // minimal stays implicit, strict stays explicit regardless of risk.
  if (shouldMoveToStarted({ profile: 'minimal', riskLevel: 'high' }) !== true) {
    throw new Error('minimal did not allow implicit start');
  }
  if (shouldMoveToStarted({ profile: 'strict', riskLevel: 'low', planConfirmed: false }) !== false) {
    throw new Error('strict auto-started without confirmation');
  }
});

// 3. Ambiguous Review states require clarification.
scenario('Ambiguous Review states require clarification', () => {
  const candidates = [
    { name: 'Code Review', type: 'started' },
    { name: 'QA Review', type: 'started' },
  ];
  if (isReviewStateAmbiguous(candidates) !== true) {
    throw new Error('two review candidates were not flagged ambiguous');
  }
  if (isReviewStateAmbiguous([{ name: 'In Review', type: 'started' }]) !== false) {
    throw new Error('a single review candidate was flagged ambiguous');
  }
});

// 4. A timed-out update is read back before retry.
scenario('A timed-out update is read back before retry', () => {
  if (REQUIRES_READBACK_AFTER_TIMEOUT !== true) {
    throw new Error('timeout read-back requirement not enforced');
  }
});

// 5. Merge alone does not mark Done (any completion gate).
scenario('Merge alone does not mark Done', () => {
  if (isDoneEligible({ mergeOnly: true, completionGate: 'release_confirmed' }) !== false) {
    throw new Error('merge-only marked Done');
  }
  if (isDoneEligible({ mergeOnly: true, completionGate: 'production_deployment' }) !== false) {
    throw new Error('merge-only marked Done under strict gate');
  }
});

// 6. Successful production deployment satisfies the release_confirmed gate.
scenario('Successful production deployment satisfies the Done gate', () => {
  if (isDoneEligible({ completionGate: 'release_confirmed', deploymentStatus: 'success', deploymentEvidence: 'https://ci/deploy/123' }) !== true) {
    throw new Error('successful deployment did not satisfy Done gate');
  }
});

// 6b. Done eligibility is gated by the active completion_gate (profile-aware).
scenario('Done eligibility respects the completion gate', () => {
  // release_confirmed: user confirmation OR trusted deployment both satisfy.
  if (isDoneEligible({ completionGate: 'release_confirmed', userConfirmedRelease: true }) !== true) {
    throw new Error('release_confirmed rejected user release confirmation');
  }
  if (isDoneEligible({ completionGate: 'release_confirmed' }) !== false) {
    throw new Error('release_confirmed marked Done with no evidence');
  }

  // production_deployment (strict): user confirmation alone is NOT enough.
  if (isDoneEligible({ completionGate: 'production_deployment', userConfirmedRelease: true }) !== false) {
    throw new Error('strict gate bypassed by user confirmation');
  }
  if (isDoneEligible({ completionGate: 'production_deployment', deploymentStatus: 'success', deploymentEvidence: 'https://ci/deploy/123' }) !== true) {
    throw new Error('strict gate rejected valid production evidence');
  }
  if (isDoneEligible({ completionGate: 'production_deployment', deploymentStatus: 'success' }) !== false) {
    throw new Error('strict gate accepted deployment without evidence');
  }

  // manual: only explicit manual confirmation satisfies.
  if (isDoneEligible({ completionGate: 'manual', manualConfirmation: true }) !== true) {
    throw new Error('manual gate rejected manual confirmation');
  }
  if (isDoneEligible({ completionGate: 'manual', userConfirmedRelease: true }) !== false) {
    throw new Error('manual gate accepted user release confirmation');
  }
  if (isDoneEligible({ completionGate: 'manual' }) !== false) {
    throw new Error('manual gate marked Done with no confirmation');
  }
});

// 6c. An unknown/misspelled completion gate fails closed (never release_confirmed).
scenario('Unknown completion gate fails closed', () => {
  if (isDoneEligible({ completionGate: 'typo_gate' }) !== false) {
    throw new Error('unknown completion gate was silently eligible');
  }
  if (isDoneEligible({ completionGate: 'merge' }) !== false) {
    throw new Error('removed completion gate "merge" was silently eligible');
  }
  if (isDoneEligible({ completionGate: '', userConfirmedRelease: true }) !== false) {
    throw new Error('empty completion gate was silently eligible');
  }
});

// 6d. getCompletionGate fails closed on an unknown profile (no silent downgrade).
scenario('getCompletionGate fails closed on unknown profile', () => {
  let threw = false;
  try {
    getCompletionGate('unknown_profile', {});
  } catch {
    threw = true;
  }
  if (!threw) throw new Error('getCompletionGate silently downgraded unknown profile to standard');

  // Valid profiles still resolve, and overrides apply.
  if (getCompletionGate('minimal', {}) !== 'release_confirmed') {
    throw new Error('minimal profile did not resolve to release_confirmed');
  }
  if (getCompletionGate('strict', {}) !== 'production_deployment') {
    throw new Error('strict profile did not resolve to production_deployment');
  }
  if (getCompletionGate('minimal', { completion_gate: 'manual' }) !== 'manual') {
    throw new Error('minimal override to manual was not applied');
  }
});

// 7. Comment failure is reported as partial success.
scenario('Comment failure is reported as partial success', () => {
  const r = summarizePartial(true, false);
  if (r !== 'partial: state updated, comment failed') {
    throw new Error('comment failure not reported as partial: ' + r);
  }
});

// 8. Alphanumeric project identifier prefixes are handled consistently.
scenario('Alphanumeric project identifier prefixes are handled consistently', () => {
  const ids = extractIdentifiers('W1N-17 and F1-2 and ABC-123');
  assertDeepEqual(ids, ['W1N-17', 'F1-2', 'ABC-123']);
  // Boundary safety: ABC-12 must not swallow ABC-123.
  const both = extractIdentifiers('fixes ABC-12 and ABC-123');
  if (!both.includes('ABC-12') || !both.includes('ABC-123')) {
    throw new Error('boundary-safe extraction failed: ' + JSON.stringify(both));
  }
  if (!isValidIdentifier('W1N-17')) throw new Error('W1N-17 not recognized as valid');
});

// 9. Writes are confined to the resolved Plane project.
scenario('Work-item writes require a matching resolved project', () => {
  if (scopeAllows({ resolvedProjectId: 'project-a', workItemProjectId: 'project-a' }) !== true) {
    throw new Error('matching project was rejected');
  }
  if (scopeAllows({ resolvedProjectId: 'project-a', workItemProjectId: 'project-b' }) !== false) {
    throw new Error('cross-project write was allowed');
  }
  if (scopeAllows({ resolvedProjectId: 'project-a' }) !== false) {
    throw new Error('write without a work-item project was allowed');
  }
});

// 10. A triage work item is classified correctly.
scenario('A triage work item is classified correctly', () => {
  // A triage label is a workflow/process label, not a defect -> Feature/Other.
  if (classifyWorkItem({ labels: ['triage'] }) !== 'Feature/Other') {
    throw new Error('triage-labeled work item misclassified as Bug');
  }
  // An explicit Bug type is classified as Bug.
  if (classifyWorkItem({ type: 'Bug' }) !== 'Bug') {
    throw new Error('Bug-type work item not classified as Bug');
  }
});

export function runBehaviorTests() {
  let passed = 0;
  let failed = 0;
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    try {
      s.fn();
      passed++;
      console.log(`  ok:   [${i + 1}] ${s.name}`);
    } catch (e) {
      failed++;
      console.error(`  FAIL: [${i + 1}] ${s.name} -> ${e.message}`);
    }
  }
  return { passed, failed, total: scenarios.length };
}

// Allow running directly: `node scripts/behavior.test.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { passed, failed, total } = runBehaviorTests();
  console.log(`\n${passed}/${total} behavior scenario(s) passed, ${failed} failed.`);
  if (failed) process.exit(1);
  console.log('All behavior scenarios passed.');
}
