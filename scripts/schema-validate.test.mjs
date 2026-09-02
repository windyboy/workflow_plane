#!/usr/bin/env node
// scripts/schema-validate.test.mjs
//
// Phase 0.0 (W1N-27 baseline) — compile the programmatic getSchema() with Ajv
// and assert the valid / forbidden / negative-control matrix. This guards the
// configuration-validation baseline that v0.5 is built on: the getSchema() allOf
// conditional constraints must NOT over-fire (the W1N-27 regression, where the
// `if` clauses lacked `required` and matched vacuously, rejecting valid configs
// such as `standard` + `plan_confirmation: implicit`).
//
// Requires NO Plane workspace and performs NO writes.
import Ajv from 'ajv';
import { getSchema } from './profile-parser.mjs';

const schema = getSchema();
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const scenarios = [];
function scenario(name, fn) {
  scenarios.push({ name, fn });
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function expectValid(config, label) {
  const ok = validate(config);
  if (!ok) {
    throw new Error(`${label} should be VALID but Ajv rejected: ${ajv.errorsText(validate.errors)}`);
  }
}
function expectInvalid(config, label) {
  const ok = validate(config);
  if (ok) {
    throw new Error(`${label} should be INVALID but Ajv accepted it`);
  }
}

// --- Valid configs (accepted) ---
scenario('valid configs accepted per profile', () => {
  expectValid({ version: 1, profile: 'minimal' }, 'minimal');
  expectValid({ version: 1, profile: 'standard' }, 'standard');
  expectValid({ version: 1, profile: 'strict' }, 'strict');
});

scenario('valid: minimal + review_gate user_acceptance', () =>
  expectValid(
    { version: 1, profile: 'minimal', overrides: { review_gate: 'user_acceptance' } },
    'minimal+user_acceptance'
  )
);

scenario('valid: minimal + plan_confirmation implicit (default-allowed)', () =>
  expectValid(
    { version: 1, profile: 'minimal', overrides: { plan_confirmation: 'implicit' } },
    'minimal+implicit'
  )
);

// --- Forbidden combinations (rejected) ---
scenario('forbidden combos rejected', () => {
  expectInvalid(
    { version: 1, profile: 'minimal', overrides: { completion_gate: 'production_deployment' } },
    'minimal+prod'
  );
  expectInvalid(
    { version: 1, profile: 'minimal', overrides: { audit_comments: 'detailed' } },
    'minimal+detailed'
  );
  expectInvalid(
    { version: 1, profile: 'minimal', overrides: { release_reconciliation: 'enabled' } },
    'minimal+enabled'
  );
  expectInvalid(
    { version: 1, profile: 'standard', overrides: { completion_gate: 'merge' } },
    'merge'
  );
  expectInvalid(
    { version: 1, profile: 'strict', overrides: { completion_gate: 'production_deployment', plan_confirmation: 'implicit' } },
    'prod+implicit'
  );
  expectInvalid(
    { version: 1, profile: 'standard', overrides: { review_gate: 'pr_ready', completion_gate: 'production_deployment', audit_comments: 'none' } },
    'pr_ready+prod+none'
  );
});

// --- Negative controls: constraints must NOT over-fire (W1N-27) ---
scenario('negative control: minimal+implicit plan without production_deployment accepted (no over-fire)', () =>
  expectValid(
    { version: 1, profile: 'minimal', overrides: { plan_confirmation: 'implicit' } },
    'minimal+implicit (no over-fire)'
  )
);

scenario('negative control: standard+implicit plan without production_deployment accepted (no over-fire)', () =>
  expectValid(
    { version: 1, profile: 'standard', overrides: { plan_confirmation: 'implicit' } },
    'standard+implicit (no over-fire)'
  )
);

scenario('negative control: standard+release_confirmed+implicit accepted (no over-fire)', () =>
  expectValid(
    { version: 1, profile: 'standard', overrides: { completion_gate: 'release_confirmed', plan_confirmation: 'implicit' } },
    'standard+release+implicit'
  )
);

scenario('negative control: minimal + audit_comments none accepted (no over-fire on allOf[1])', () =>
  expectValid(
    { version: 1, profile: 'minimal', overrides: { audit_comments: 'none' } },
    'minimal+audit_none'
  )
);

scenario('negative control: minimal + release_reconciliation disabled accepted (no over-fire on allOf[2])', () =>
  expectValid(
    { version: 1, profile: 'minimal', overrides: { release_reconciliation: 'disabled' } },
    'minimal+recon_disabled'
  )
);

scenario('negative control: standard + overrides without completion_gate accepted (no over-fire on merge clause)', () =>
  expectValid(
    { version: 1, profile: 'standard', overrides: { review_gate: 'user_acceptance' } },
    'standard+no_completion_gate'
  )
);

// --- Schema structure: the conditional clauses must carry `required` (W1N-27 fix) ---
scenario('getSchema if/required clauses correct (no vacuous match)', () => {
  const allOf = schema.allOf || [];
  const prodImplicit = allOf.find((c) => /production_deployment requires explicit/.test(c.description || ''));
  assert(prodImplicit, 'production_deployment+implicit clause missing');
  assert(
    prodImplicit.if && Array.isArray(prodImplicit.if.required) && prodImplicit.if.required.includes('overrides'),
    'production_deployment+implicit if must require "overrides"'
  );
  const nested = prodImplicit.if.properties.overrides;
  assert(
    nested.required.includes('completion_gate') && nested.required.includes('plan_confirmation'),
    'production_deployment+implicit if must require completion_gate + plan_confirmation'
  );

  const prReady = allOf.find((c) => /pr_ready \+ production_deployment requires audit/.test(c.description || ''));
  assert(prReady, 'pr_ready+production_deployment clause missing');
  assert(
    prReady.if && Array.isArray(prReady.if.required) && prReady.if.required.includes('overrides'),
    'pr_ready+production_deployment if must require "overrides"'
  );
  assert(
    prReady.if.properties.overrides.required.includes('audit_comments'),
    'pr_ready+production_deployment if must require audit_comments'
  );

  // allOf[0]: minimal cannot override completion_gate to production_deployment — its
  // `not` must require both `overrides` and the nested `completion_gate` (W1N-27).
  const completionProd = allOf.find((c) => /cannot override completion_gate to production_deployment/.test(c.description || ''));
  assert(completionProd, 'minimal+completion_gate production_deployment clause missing');
  assert(
    completionProd.then && completionProd.then.not && Array.isArray(completionProd.then.not.required) && completionProd.then.not.required.includes('overrides'),
    'minimal+completion_gate production_deployment not must require "overrides"'
  );
  assert(
    completionProd.then.not.properties.overrides.required.includes('completion_gate'),
    'minimal+completion_gate production_deployment not must require nested completion_gate'
  );

  // allOf[1]: minimal cannot override audit_comments to detailed — its `not` must
  // require `overrides` and the nested `audit_comments` so it does not match
  // vacuously when audit_comments is absent (W1N-27).
  const auditDetailed = allOf.find((c) => /cannot override audit_comments to detailed/.test(c.description || ''));
  assert(auditDetailed, 'minimal+audit_comments detailed clause missing');
  assert(
    auditDetailed.then && auditDetailed.then.not && Array.isArray(auditDetailed.then.not.required) && auditDetailed.then.not.required.includes('overrides'),
    'minimal+audit_comments detailed not must require "overrides"'
  );
  assert(
    auditDetailed.then.not.properties.overrides.required.includes('audit_comments'),
    'minimal+audit_comments detailed not must require nested audit_comments'
  );

  // allOf[2]: minimal cannot override release_reconciliation to enabled — same fix.
  const reconEnabled = allOf.find((c) => /cannot override release_reconciliation to enabled/.test(c.description || ''));
  assert(reconEnabled, 'minimal+release_reconciliation enabled clause missing');
  assert(
    reconEnabled.then && reconEnabled.then.not && Array.isArray(reconEnabled.then.not.required) && reconEnabled.then.not.required.includes('overrides'),
    'minimal+release_reconciliation enabled not must require "overrides"'
  );
  assert(
    reconEnabled.then.not.properties.overrides.required.includes('release_reconciliation'),
    'minimal+release_reconciliation enabled not must require nested release_reconciliation'
  );

  // allOf[3]: completion_gate 'merge' violates Reality Check — global `not` must
  // require both `overrides` and `completion_gate` so it only fires on merge.
  const merge = allOf.find((c) => /completion_gate 'merge' violates Reality Check/.test(c.description || ''));
  assert(merge, 'merge Reality Check clause missing');
  assert(
    merge.not && Array.isArray(merge.not.required) && merge.not.required.includes('overrides'),
    'merge Reality Check not must require "overrides"'
  );
  assert(
    merge.not.properties.overrides.required.includes('completion_gate'),
    'merge Reality Check not must require completion_gate'
  );
});

export function runSchemaTests() {
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

// Allow running directly: `node scripts/schema-validate.test.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const { passed, failed, total } = runSchemaTests();
  console.log(`\n${passed}/${total} schema validation scenario(s) passed, ${failed} failed.`);
  if (failed) process.exit(1);
  console.log('All schema validation scenarios passed.');
}
