#!/usr/bin/env node
// scripts/sync-forge.mjs
//
// Generates the host runtime copy of the skill at `.forge/skills/plane-workflow/`
// from the single source of truth `plane-workflow/`.
//
// The `.forge` copy is NOT tracked in git; it is produced by this script so it
// can never drift from the source. `npm run package` (and thus `npm run ci`)
// invokes this, and `validate.mjs` enforces byte-for-byte parity afterwards.
//
// Usage: node scripts/sync-forge.mjs [--check]
//   --check  Compare source and target and exit non-zero on any drift
//             (used by validation; does not write).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'plane-workflow');
const dest = join(root, '.forge', 'skills', 'plane-workflow');
const checkOnly = process.argv.includes('--check');

function collect(dir, base = '') {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    const rel = base ? base + '/' + e : e;
    if (statSync(full).isDirectory()) out.push(...collect(full, rel));
    else out.push(rel);
  }
  return out;
}

function copyFile(rel) {
  const from = join(src, rel);
  const to = join(dest, rel);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, readFileSync(from));
}

function removeFile(rel) {
  rmSync(join(dest, rel), { force: true });
}

if (!existsSync(src)) {
  console.error('source missing: ' + src);
  process.exit(1);
}

const srcFiles = new Set(collect(src));
const destFiles = new Set(existsSync(dest) ? collect(dest) : []);

let changed = 0;

// Add/refresh every source file in the target.
for (const rel of srcFiles) {
  const from = join(src, rel);
  const to = join(dest, rel);
  const needsUpdate =
    !destFiles.has(rel) ||
    readFileSync(from, 'utf-8') !== readFileSync(to, 'utf-8');
  if (needsUpdate) {
    changed++;
    if (!checkOnly) copyFile(rel);
  }
}

// Prune target files that no longer exist in the source.
for (const rel of destFiles) {
  if (!srcFiles.has(rel)) {
    changed++;
    if (!checkOnly) removeFile(rel);
  }
}

const rel = relative(root, dest);
if (changed === 0) {
  console.log('✓ ' + rel + ' already in parity with plane-workflow/');
  process.exit(0);
}

if (checkOnly) {
  console.error('✗ ' + rel + ' is out of sync with plane-workflow/ (' + changed + ' file(s) differ)');
  console.error('  Run: npm run sync:forge');
  process.exit(1);
}

console.log('✓ Synced ' + srcFiles.size + ' file(s) to ' + rel + ' (' + changed + ' changed)');
