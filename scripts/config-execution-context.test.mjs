// scripts/config-execution-context.test.mjs
//
// Tests for the INDEPENDENT execution_context (Layer 2) configuration:
//  - it is NOT a Profile strategy item (STRATEGY_SCHEMA / mergeConfig untouched)
//  - parseSimpleYAML accepts a nested `execution_context:` block
//  - validateConfig accepts/rejects execution_context correctly
//  - resolveExecutionContext normalizes defaults and fails closed

import {
  STRATEGY_SCHEMA,
  EXECUTION_CONTEXT_SCHEMA,
  parseSimpleYAML,
  validateConfig,
  resolveExecutionContext,
  mergeConfig,
} from './profile-parser.mjs';

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

// --- Independence from the six Profile strategies -------------------------

scenario('execution_context is not a strategy item', () => {
  assert(!('execution_context' in STRATEGY_SCHEMA), 'execution_context must not appear in STRATEGY_SCHEMA');
  assert(Object.keys(STRATEGY_SCHEMA).length === 6, 'STRATEGY_SCHEMA must keep exactly 6 items');
});

scenario('mergeConfig never touches execution_context', () => {
  const merged = mergeConfig('standard', {});
  assert(!('execution_context' in merged), 'mergeConfig output must not contain execution_context');
});

// --- YAML parsing of a nested execution_context block -----------------------

scenario('parseSimpleYAML parses a nested execution_context block', () => {
  const yaml = [
    'version: 1',
    'profile: standard',
    'execution_context:',
    '  mode: required',
    '  root: .work',
  ].join('\n');
  const parsed = parseSimpleYAML(yaml);
  eq(parsed.execution_context, { mode: 'required', root: '.work' });
});

scenario('parseSimpleYAML still parses overrides (no regression)', () => {
  const yaml = [
    'version: 1',
    'profile: minimal',
    'overrides:',
    '  review_gate: pr_ready',
  ].join('\n');
  const parsed = parseSimpleYAML(yaml);
  eq(parsed.overrides, { review_gate: 'pr_ready' });
});

scenario('parseSimpleYAML parses a nested execution_context block (validation deferred)', () => {
  const yaml = [
    'version: 1',
    'profile: standard',
    'execution_context:',
    '  mode: required',
    '  root: .work',
    '  bogus: yes',
  ].join('\n');
  // The generic parser accepts the nested block; the unknown key is rejected later by validateConfig.
  const parsed = parseSimpleYAML(yaml);
  eq(parsed.execution_context.mode, 'required');
  eq(parsed.execution_context.root, '.work');
  eq(parsed.execution_context.bogus, 'yes');
  const res = validateConfig({ version: 1, profile: 'standard', execution_context: { mode: 'required', root: '.work', bogus: 'yes' } });
  assert(!res.valid, 'validateConfig must reject the unknown execution_context field');
});

// --- validateConfig acceptance / rejection ----------------------------------

scenario('validateConfig accepts a valid execution_context block', () => {
  const cfg = {
    version: 1,
    profile: 'standard',
    execution_context: { mode: 'auto', root: '.agent-work', format: 'execution_context_v1' },
  };
  const res = validateConfig(cfg);
  assert(res.valid, 'valid execution_context rejected: ' + res.errors.join('; '));
});

scenario('validateConfig rejects unknown execution_context field', () => {
  const cfg = {
    version: 1,
    profile: 'standard',
    execution_context: { mode: 'auto', bogus: true },
  };
  const res = validateConfig(cfg);
  assert(!res.valid, 'unknown execution_context field must be rejected');
  assert(res.errors.some((e) => e.includes('bogus')), 'error should name the unknown field');
});

scenario('validateConfig rejects invalid mode enum', () => {
  const cfg = { version: 1, profile: 'standard', execution_context: { mode: 'sometimes' } };
  const res = validateConfig(cfg);
  assert(!res.valid, 'invalid mode must be rejected');
});

scenario('validateConfig rejects non-string root', () => {
  const cfg = { version: 1, profile: 'standard', execution_context: { mode: 'required', root: 42 } };
  const res = validateConfig(cfg);
  assert(!res.valid, 'non-string root must be rejected');
});

scenario('validateConfig rejects unknown top-level key (not silently dropped)', () => {
  const cfg = { version: 1, profile: 'standard', execution_context: { mode: 'disabled' }, surprise: true };
  const res = validateConfig(cfg);
  assert(!res.valid, 'unknown top-level key must be rejected');
});

// --- resolveExecutionContext normalization ----------------------------------

scenario('resolveExecutionContext defaults to disabled when absent', () => {
  eq(resolveExecutionContext({ version: 1, profile: 'standard' }), { mode: 'disabled' });
});

scenario('resolveExecutionContext fills root/format defaults for auto', () => {
  eq(resolveExecutionContext({ execution_context: { mode: 'auto' } }), {
    mode: 'auto',
    root: EXECUTION_CONTEXT_SCHEMA.DEFAULT_ROOT,
    format: EXECUTION_CONTEXT_SCHEMA.DEFAULT_FORMAT,
  });
});

scenario('resolveExecutionContext preserves explicit root/format', () => {
  eq(resolveExecutionContext({ execution_context: { mode: 'required', root: '.myctx', format: 'execution_context_v1' } }), {
    mode: 'required',
    root: '.myctx',
    format: 'execution_context_v1',
  });
});

scenario('resolveExecutionContext fails closed on unknown field', () => {
  let threw = false;
  try { resolveExecutionContext({ execution_context: { mode: 'auto', ghost: 1 } }); } catch { threw = true; }
  assert(threw, 'unknown execution_context field must fail closed');
});

scenario('resolveExecutionContext fails closed on invalid mode', () => {
  let threw = false;
  try { resolveExecutionContext({ execution_context: { mode: 'nope' } }); } catch { threw = true; }
  assert(threw, 'invalid mode must fail closed');
});

scenario('resolveExecutionContext fails closed on non-string root', () => {
  let threw = false;
  try { resolveExecutionContext({ execution_context: { mode: 'required', root: [] } }); } catch { threw = true; }
  assert(threw, 'non-string root must fail closed');
});

// --- Summary ----------------------------------------------------------------

console.log(`\n${passed}/${passed + failed} execution-context config scenario(s) passed, ${failed} failed.`);
if (failed > 0) {
  console.error('\nFailures:');
  for (const f of failures) console.error(`  - ${f.name}: ${f.err.message}`);
  process.exit(1);
}
console.log('All execution-context config scenarios passed.');
