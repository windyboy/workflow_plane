#!/usr/bin/env node
// scripts/cli.test.mjs
//
// Black-box tests for the plane-workflow CLI. These spawn the real
// scripts/diagnose.mjs via child_process so we exercise the actual argument
// protocol (not just the internal functions). This is what catches the
// historical bug where `config diagnose` was treated as a config file name.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'scripts', 'diagnose.mjs');
const fixtures = join(root, 'scripts', 'fixtures');

let passed = 0;
let failed = 0;
function ok(name) {
  passed++;
  console.log('  ok:   ' + name);
}
function fail(name, detail) {
  failed++;
  console.error('  FAIL: ' + name + (detail ? ' -> ' + detail : ''));
}

function run(args) {
  try {
    const out = execFileSync('node', [script, ...args], { encoding: 'utf-8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

// 1. `config diagnose` with no file defaults to the standard profile.
{
  const { code, out } = run(['config', 'diagnose']);
  if (code === 0 && /Profile: standard/.test(out)) ok('config diagnose defaults to standard');
  else fail('config diagnose defaults to standard', `code=${code}`);
}

// 2. `config diagnose <file>` reads the real config path (not the literal word).
{
  const { code, out } = run(['config', 'diagnose', join(fixtures, 'strict.yaml')]);
  if (code === 0 && /Profile: strict/.test(out)) ok('config diagnose reads explicit config file');
  else fail('config diagnose reads explicit config file', `code=${code}`);
}

// 3. `config schema` prints valid JSON Schema with required version+profile.
{
  const { code, out } = run(['config', 'schema']);
  let parsed = null;
  try {
    parsed = JSON.parse(out);
  } catch {
    /* handled below */
  }
  const reqOk =
    parsed && Array.isArray(parsed.required) && parsed.required.includes('version') && parsed.required.includes('profile');
  if (code === 0 && reqOk) ok('config schema emits JSON Schema with required version+profile');
  else fail('config schema emits JSON Schema', `code=${code}`);
}

// 4. `config diagnose <invalid>` fails closed (non-zero exit).
{
  const { code } = run(['config', 'diagnose', join(fixtures, 'invalid.yaml')]);
  if (code !== 0) ok('config diagnose rejects invalid config (exit non-zero)');
  else fail('config diagnose rejects invalid config', 'exit 0');
}

// 5. `help` prints usage and exits 0.
{
  const { code, out } = run(['help']);
  if (code === 0 && /Usage:/.test(out)) ok('help prints usage');
  else fail('help prints usage', `code=${code}`);
}

// 6. Unknown config subcommand fails closed.
{
  const { code } = run(['config', 'bogus']);
  if (code !== 0) ok('unknown config subcommand fails closed');
  else fail('unknown config subcommand fails closed', 'exit 0');
}

// 7. Unknown top-level command fails closed.
{
  const { code } = run(['frobnicate']);
  if (code !== 0) ok('unknown top-level command fails closed');
  else fail('unknown top-level command fails closed', 'exit 0');
}

// 8. `config diagnose` with an execution_context config surfaces the local
//    Execution Context (Layer 2) section with mode/root/format.
{
  const { code, out } = run(['config', 'diagnose', join(fixtures, 'execution-context.yaml')]);
  const ecOk =
    code === 0 &&
    /Execution Context \(Layer 2, local only\)/.test(out) &&
    /mode: required/.test(out) &&
    /root: \.agent-work/.test(out) &&
    /format: execution_context_v1/.test(out);
  if (ecOk) ok('config diagnose surfaces local execution_context');
  else fail('config diagnose surfaces local execution_context', `code=${code}`);
}

// 9. `diagnose` must NOT fabricate a resolved Workflow Binding (it has no
//    Plane/Binding provider). The output is local config only.
{
  const { code, out } = run(['config', 'diagnose', join(fixtures, 'execution-context.yaml')]);
  const noBinding = code === 0 && !/Workflow Binding/.test(out) && !/Binding/.test(out);
  if (noBinding) ok('diagnose shows no fabricated Workflow Binding');
  else fail('diagnose shows no fabricated Workflow Binding', `matched Binding in output`);
}

console.log(`\nCLI tests: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
