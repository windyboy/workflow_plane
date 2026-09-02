// scripts/workflow-binding.test.mjs
//
// Tests for the Layer 1 Workflow Binding payload helper (scripts/binding-payload.mjs).
// Covers: payload round-trip, six-strategy freeze, fingerprint integrity,
// classify 0/1/>1, verify mismatch, and the auto two-field split.

import {
  BINDING_SCHEMA_VERSION,
  CONTEXT_DECISION,
  RESOLVED_STRATEGY_KEYS,
  computeFingerprint,
  validateBinding,
  buildBinding,
  serializeBinding,
  parseBinding,
  classifyBindings,
  verifyBinding,
} from './binding-payload.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;
const failures = [];

function scenario(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok:   [${passed + failed}] ${name}`);
  } catch (err) {
    failed += 1;
    failures.push({ name, err });
    console.log(`  FAIL: [${passed + failed}] ${name}\n        ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
function eq(actual, expected, msg) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg || 'value mismatch'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const SIX = {
  plan_confirmation: 'risk_based',
  review_gate: 'pr_ready',
  completion_gate: 'release_confirmed',
  audit_comments: 'summary',
  release_reconciliation: 'on_request',
  output_verbosity: 'standard',
};

function makeBinding(over = {}) {
  return buildBinding({
    workItemUuid: 'uuid-abc',
    workItemIdentifier: 'W1N-28',
    projectId: 'team-1',
    profile: 'standard',
    resolvedStrategies: { ...SIX },
    executionContext: { mode: 'auto' },
    configuredMode: 'auto',
    contextDecision: 'enabled',
    ...over,
  });
}

scenario('binding payload serialize/parse round-trip', () => {
  const b = makeBinding();
  const text = serializeBinding(b);
  const parsed = parseBinding(text);
  eq(parsed.workitem_uuid, 'uuid-abc');
  eq(parsed.schema_version, BINDING_SCHEMA_VERSION);
  eq(parsed.payload_fingerprint, b.payload_fingerprint);
});

scenario('binding freezes all six resolved_strategies', () => {
  const b = makeBinding();
  const v = validateBinding(b);
  assert(v.valid, 'binding should be valid: ' + v.errors.join('; '));
  for (const key of RESOLVED_STRATEGY_KEYS) {
    assert(key in b.resolved_strategies, `missing ${key}`);
  }
  eq(Object.keys(b.resolved_strategies).sort(), RESOLVED_STRATEGY_KEYS.slice().sort());
});

scenario('binding without an immutable UUID uses a required identifier snapshot', () => {
  const b = makeBinding({ workItemUuid: undefined, workItemIdentifier: 'W1N-29' });
  const v = validateBinding(b);
  assert(v.valid, 'identifier-only binding must validate: ' + v.errors.join('; '));
  assert(!('workitem_uuid' in b), 'identifier-only binding must not fabricate a UUID');
  eq(classifyBindings([b], { commentScoped: true }).count, 1, 'comment-scoped read must find the binding');
});

scenario('binding with missing strategy fails closed', () => {
  const rs = { ...SIX };
  delete rs.audit_comments;
  const b = buildBinding({ resolvedStrategies: rs, configuredMode: 'auto', contextDecision: 'enabled' });
  const v = validateBinding(b);
  assert(!v.valid, 'binding missing a strategy must be invalid');
  assert(v.errors.some((e) => e.includes('audit_comments')), 'error should name the missing strategy');
});

scenario('fingerprint is deterministic and excludes bound_at', () => {
  const b1 = makeBinding({ boundAt: '2026-01-01T00:00:00Z' });
  const b2 = makeBinding({ boundAt: '2099-12-31T00:00:00Z' });
  eq(b1.payload_fingerprint, b2.payload_fingerprint, 'fingerprint must ignore bound_at');
  // recomputing from frozen payload (without bound_at) matches
  eq(computeFingerprint(b1), b1.payload_fingerprint);
});

scenario('fingerprint detects payload mutation (integrity, not authenticity)', () => {
  const b = makeBinding();
  const mutated = { ...b, resolved_strategies: { ...SIX, review_gate: 'user_acceptance' } };
  const v = validateBinding(mutated);
  assert(!v.valid, 'mutated frozen payload must fail fingerprint check');
  assert(v.errors.some((e) => e.includes('payload_fingerprint')), 'error should name fingerprint mismatch');
});

scenario('binding requires a non-null execution_context and fingerprint', () => {
  const b = makeBinding();
  const nullContext = { ...b, execution_context: null };
  assert(!validateBinding(nullContext).valid, 'null execution_context must fail closed');
  const missingFingerprint = { ...b };
  delete missingFingerprint.payload_fingerprint;
  assert(!validateBinding(missingFingerprint).valid, 'missing fingerprint must fail closed');
});

scenario('classifyBindings: 0 / 1 / >1 by workitem_uuid', () => {
  eq(classifyBindings([], 'uuid-abc').count, 0);
  const one = makeBinding();
  eq(classifyBindings([one], 'uuid-abc').count, 1);
  const dup = makeBinding();
  eq(classifyBindings([one, dup], 'uuid-abc').count, 2);
  eq(classifyBindings([makeBinding({ workItemUuid: 'other' })], 'uuid-abc').count, 0);
});

scenario('verifyBinding reports mismatch on workitem_uuid / schema / fingerprint', () => {
  const b = makeBinding();
  assert(verifyBinding(b, b).ok, 'identical binding should verify');
  assert(!verifyBinding(b, { ...b, workitem_uuid: 'x' }).ok, 'workitem_uuid mismatch must fail');
  assert(!verifyBinding({ ...b, schema_version: 'other' }, b).ok, 'schema mismatch must fail');
  const tampered = { ...b, resolved_strategies: { ...SIX, review_gate: 'user_acceptance' } };
  assert(!verifyBinding(tampered, b).ok, 'fingerprint mismatch must fail');
  const recomputed = { ...tampered };
  recomputed.payload_fingerprint = computeFingerprint(recomputed);
  assert(!verifyBinding(recomputed, b).ok, 'recomputed fingerprint for a changed payload must not bypass the frozen binding');
});

scenario('auto binding records configured_mode + context_decision', () => {
  const b = makeBinding({ configuredMode: 'auto', contextDecision: 'enabled' });
  eq(b.configured_mode, 'auto');
  assert(CONTEXT_DECISION.includes(b.context_decision), 'context_decision must be in allowed set');
  const v = validateBinding(b);
  assert(v.valid, 'auto binding must validate: ' + v.errors.join('; '));
});

scenario('context_decision not_needed is valid for auto', () => {
  const b = makeBinding({ configuredMode: 'auto', contextDecision: 'not_needed' });
  const v = validateBinding(b);
  assert(v.valid, 'auto + not_needed must validate: ' + v.errors.join('; '));
});

scenario('disabled mode binding still carries minimal Layer 1 record', () => {
  // Per v4 correction #4: disabled disables Layer 2 only; a newly bound workItem
  // still gets the minimal Layer 1 Binding (configured_mode + context_decision).
  const b = makeBinding({ executionContext: { mode: 'disabled' }, configuredMode: 'disabled', contextDecision: 'not_needed' });
  const v = validateBinding(b);
  assert(v.valid, 'disabled-mode minimal binding must validate: ' + v.errors.join('; '));
});

scenario('legacy workItem with no binding is represented as count 0 (no invention)', () => {
  const { count, matches } = classifyBindings([], 'uuid-legacy');
  eq(count, 0);
  eq(matches, []);
});

// --- Integration: read / write / read-back against an in-memory comment store ---
// Pure, Plane-free simulation of the runtime procedure in
// plane-workflow/references/workflow-binding.md. Proves the read → write →
// read-back loop and the 0/1/>1/mismatch resolution using only the deterministic
// helpers (no MCP/API I/O).

function mockBindingStore(workItemUuid) {
  const comments = []; // array of comment bodies (strings)
  const readBinding = () => classifyBindings(comments.map(parseBinding).filter(Boolean), workItemUuid);
  const writeBinding = (payload) => {
    const v = validateBinding(payload);
    assert(v.valid, 'payload must validate before write: ' + v.errors.join('; '));
    comments.push(serializeBinding(payload));
  };
  // Idempotent write: an identical fingerprint for the same workitem_uuid is a
  // duplicate and must NOT create a second comment (de-dup, no overwrite).
  const writeBindingIdempotent = (payload) => {
    const v = validateBinding(payload);
    assert(v.valid, 'payload must validate before write: ' + v.errors.join('; '));
    const { count, matches } = readBinding();
    if (count >= 1 && matches[0].payload_fingerprint === payload.payload_fingerprint) return 'dedup';
    comments.push(serializeBinding(payload));
    return 'written';
  };
  const readBackBinding = (expected) => {
    const { count, matches } = readBinding();
    if (count !== 1) return { ok: false, reason: `expected exactly 1 binding, got ${count}` };
    return verifyBinding(matches[0], expected);
  };
  return { comments, readBinding, writeBinding, writeBindingIdempotent, readBackBinding };
}

scenario('read/write/read-back round-trip via mock comment store', () => {
  const store = mockBindingStore('uuid-rt');
  eq(store.readBinding().count, 0, 'starts with 0 bindings');
  const b = makeBinding({ workItemUuid: 'uuid-rt' });
  eq(store.writeBindingIdempotent(b), 'written');
  const rb = store.readBackBinding(b);
  assert(rb.ok, 'read-back must verify the written binding: ' + (rb.reason || ''));
  eq(store.readBinding().count, 1, 'exactly one binding after write');
  // Identical re-write is de-duped, not a second binding.
  eq(store.writeBindingIdempotent(b), 'dedup');
  eq(store.readBinding().count, 1, 'identical re-write is de-duped, not a second binding');
});

scenario('>1 bindings → fail closed (require user resolution)', () => {
  const store = mockBindingStore('uuid-dup');
  // Two different frozen configs for the same workItem (concurrent first-takeover).
  store.writeBinding(makeBinding({ workItemUuid: 'uuid-dup', contextDecision: 'enabled' }));
  store.writeBinding(makeBinding({ workItemUuid: 'uuid-dup', contextDecision: 'not_needed' }));
  eq(store.readBinding().count, 2, 'two bindings detected');
  const rb = store.readBackBinding(makeBinding({ workItemUuid: 'uuid-dup', contextDecision: 'enabled' }));
  assert(!rb.ok, 'read-back must fail closed when >1 binding exists');
  eq(rb.reason, 'expected exactly 1 binding, got 2');
});

scenario('payload mismatch → no overwrite, report conflict', () => {
  const store = mockBindingStore('uuid-mm');
  const first = makeBinding({ workItemUuid: 'uuid-mm', contextDecision: 'enabled' });
  store.writeBinding(first);
  // A later resolution disagrees with the frozen config; the host must NOT overwrite.
  const conflicting = makeBinding({ workItemUuid: 'uuid-mm', contextDecision: 'not_needed' });
  const rb = store.readBackBinding(conflicting);
  assert(!rb.ok, 'read-back of a conflicting config must fail (frozen config differs)');
  assert(rb.reason.includes('payload_fingerprint'), 'reason should name fingerprint mismatch');
  eq(store.readBinding().count, 1, 'the conflicting config was NOT written over the frozen one');
});

scenario('runtime protocol requires Plane MCP reads, comment write, and fresh read-back', () => {
  const protocol = readFileSync(
    join(process.cwd(), 'plane-workflow/references/workflow-binding.md'),
    'utf8',
  );
  assert(/official Plane MCP calls discovered/i.test(protocol), 'protocol must require Plane MCP execution');
  assert(/workitem_comment\(action=\"list\"/i.test(protocol), 'protocol must require MCP comment listing');
  assert(/workitem_comment\(action=\"create\"/i.test(protocol), 'protocol must require MCP comment creation');
  assert(/Read comments again/i.test(protocol), 'protocol must require a fresh read-back');
});

console.log(`\n${passed}/${passed + failed} workflow-binding scenario(s) passed, ${failed} failed.`);
if (failed > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error(`  - ${f.name}: ${f.err.message}`);
  process.exit(1);
}
console.log('All workflow-binding scenarios passed.');
