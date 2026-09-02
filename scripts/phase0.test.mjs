#!/usr/bin/env node
// scripts/phase0.test.mjs
//
// Phase 0 (W1N-28 §5) — Review Gate / Completion Gate consistency.
//
// Two kinds of checks:
//   1. Pure-function checks for the state-selection helpers added to policy.mjs
//      (selectStartedState / selectReviewState / mayMoveToReview). These use
//      fixture project states, mirroring how the runtime resolves concrete Plane
//      state names from discovered workflow states (v4 correction #3: the Review
//      Gate policy decides WHEN, the project workflow decides WHICH state).
//   2. A documentation-consistency check proving the resolved policy is the
//      single source of truth: review-gate-policy.md no longer claims
//      `user_acceptance` is the global default or that the Completion Gate is
//      always `production_deployment`, and no child reference declares a
//      competing gate default.
//
// Requires NO Plane workspace and performs NO writes.
import fs from 'fs';
import path from 'path';
import { selectStartedState, selectReviewState, mayMoveToReview } from './policy.mjs';

const scenarios = [];
function scenario(name, fn) {
  scenarios.push({ name, fn });
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// --- selectStartedState ---
scenario('selectStartedState resolves the single started state', () => {
  const states = [
    { name: 'Todo', type: 'unstarted' },
    { name: 'In Progress', type: 'started' },
    { name: 'Done', type: 'completed' },
  ];
  assert(selectStartedState(states) === 'In Progress', 'should resolve In Progress');
});

scenario('selectStartedState honors an explicit stateMapping', () => {
  const states = [{ name: 'Backlog', type: 'backlog' }];
  assert(selectStartedState(states, { started: 'Working' }) === 'Working', 'mapping should win');
});

scenario('selectStartedState returns null when ambiguous', () => {
  const states = [
    { name: 'Dev', type: 'started' },
    { name: 'QA', type: 'started' },
  ];
  assert(selectStartedState(states) === null, 'ambiguous started states -> null');
});

scenario('selectStartedState returns null when absent', () => {
  assert(selectStartedState([{ name: 'Backlog', type: 'backlog' }]) === null, 'no started state -> null');
});

// --- selectReviewState ---
scenario('selectReviewState resolves the single review state', () => {
  const states = [
    { name: 'In Progress', type: 'started' },
    { name: 'In Review', type: 'review' },
  ];
  assert(selectReviewState(states) === 'In Review', 'should resolve In Review');
});

scenario('selectReviewState matches by name when type is missing', () => {
  const states = [{ name: 'Code Review' }];
  assert(selectReviewState(states) === 'Code Review', 'name-based review match');
});

scenario('selectReviewState returns null when ambiguous', () => {
  const states = [
    { name: 'Peer Review', type: 'review' },
    { name: 'Final Review', type: 'review' },
  ];
  assert(selectReviewState(states) === null, 'ambiguous review states -> null');
});

// --- mayMoveToReview (Review Gate policy decides WHEN) ---
scenario('mayMoveToReview: pr_ready requires PR created AND CI passed', () => {
  assert(mayMoveToReview({ prCreated: true, ciPassed: true }, 'pr_ready') === true, 'pr_ready satisfied');
  assert(mayMoveToReview({ prCreated: true, ciPassed: false }, 'pr_ready') === false, 'ci missing');
  assert(mayMoveToReview({ prCreated: false, ciPassed: true }, 'pr_ready') === false, 'pr missing');
});

scenario('mayMoveToReview: user_acceptance requires explicit user acceptance', () => {
  assert(mayMoveToReview({ userAccepted: true }, 'user_acceptance') === true, 'user_acceptance satisfied');
  assert(mayMoveToReview({ prCreated: true, ciPassed: true }, 'user_acceptance') === false, 'pr_ready evidence does not satisfy user_acceptance');
});

scenario('mayMoveToReview fails closed on unknown policy', () => {
  assert(mayMoveToReview({ prCreated: true, ciPassed: true }, 'bogus') === false, 'unknown policy -> false');
});

// --- Documentation consistency: resolved policy is the single source of truth ---
function readRel(p) {
  return fs.readFileSync(path.join(process.cwd(), p), 'utf8');
}

scenario('review-gate-policy.md no longer claims user_acceptance is the global default', () => {
  const doc = readRel('plane-workflow/references/review-gate-policy.md');
  assert(!/user_acceptance`\s*\(default\)/i.test(doc), 'doc must not claim `user_acceptance` (default)');
  assert(/pr_ready`\s*\(default for `minimal` and `standard`\)/i.test(doc), 'doc must state pr_ready is the minimal/standard default');
  assert(/user_acceptance`\s*\(default for `strict`\)/i.test(doc), 'doc must state user_acceptance is the strict default');
});

scenario('review-gate-policy.md no longer claims the Completion Gate is always production_deployment', () => {
  const doc = readRel('plane-workflow/references/review-gate-policy.md');
  assert(!/always`?\s*production_deployment/i.test(doc), 'doc must not claim the Completion Gate is always production_deployment');
  assert(/completion gate is profile-driven/i.test(doc), 'doc must state the Completion Gate is profile-driven');
});

scenario('no child reference declares a competing gate default', () => {
  const refs = [
    'plane-workflow/SKILL.md',
    'plane-workflow/mark-done.md',
    'plane-workflow/references/move-to-review.md',
    'plane-workflow/references/start-implementation.md',
    'plane-workflow/references/resume-work.md',
  ];
  const forbidden = [/user_acceptance`\s*\(default\)/i, /always`?\s*production_deployment/i];
  for (const ref of refs) {
    const doc = readRel(ref);
    for (const re of forbidden) {
      assert(!re.test(doc), `${ref} must not declare a competing gate default (${re})`);
    }
  }
});

scenario('start-implementation.md routes start authorization by the effective plan_confirmation profile', () => {
  const doc = readRel('plane-workflow/references/start-implementation.md');
  // Must route by profile, not hard-code a single confirmation rule.
  assert(/plan_confirmation/i.test(doc), 'doc must route start authorization via plan_confirmation');
  for (const mode of ['implicit', 'risk_based', 'explicit']) {
    assert(new RegExp(`\`?${mode}\`?`).test(doc), `doc must enumerate the ${mode} plan_confirmation mode`);
  }
  // Regression guard: the old unconditional "always wait for explicit confirmation" rule must be gone.
  assert(!/Wait for user confirmation \("start processing"/.test(doc), 'doc must not hard-code an unconditional confirmation rule');
});

scenario('SKILL.md does not claim disabled mode has no behavior change', () => {
  const doc = readRel('plane-workflow/SKILL.md');
  // Regression guard: the v4 plan explicitly prohibited claiming disabled = no behavior change.
  assert(!/no local files are created and behavior is unchanged/i.test(doc), 'SKILL.md must not claim disabled mode is behaviorally unchanged');
  // Correct wording: disabled creates no Layer 2 files but still writes the minimal Layer 1 Binding.
  assert(/no Layer 2 files are created/i.test(doc), 'SKILL.md must state disabled creates no Layer 2 files');
  assert(/minimal Layer 1 Workflow Binding/i.test(doc), 'SKILL.md must state disabled still writes the minimal Layer 1 Binding');
});

export function runPhase0Tests() {
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

// Allow running directly: `node scripts/phase0.test.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { passed, failed, total } = runPhase0Tests();
  console.log(`\n${passed}/${total} Phase 0 scenario(s) passed, ${failed} failed.`);
  if (failed) process.exit(1);
  console.log('All Phase 0 scenarios passed.');
}
