#!/usr/bin/env node

// scripts/install-verify.mjs
//
// Verifies that the packaged artifact (dist/plane-workflow.skill) matches
// the source tree (plane-workflow/) AND that it installs into a clean
// runtime correctly (Source -> Dist -> Runtime parity).
//
// Steps performed:
//   - Critical files present in source and artifact
//   - metadata.json is REQUIRED inside the artifact (not optional)
//   - The artifact is extracted into an independent temp runtime
//   - All critical files are present in the installed runtime
//   - The embedded metadata (version/commit/sourceHash) is valid and consistent
//   - A fresh checksum of the installed runtime matches the stored sourceHash

import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'plane-workflow');
const out = join(root, 'dist', 'plane-workflow.skill');
const metadataFile = join(root, 'dist', 'plane-workflow.metadata.json');

console.log('Plane Workflow Install Verification');
console.log('=====================================\n');

let failed = false;
const fail = (m) => { console.error('✗ ' + m); failed = true; };
const ok = (m) => console.log('✓ ' + m);

// Step 1: Source directory exists
if (!existsSync(src)) { fail('Source directory missing: ' + src); process.exit(1); }
ok('Source directory exists: ' + src);

// Step 2: Packaged artifact exists
if (!existsSync(out)) {
  fail('Packaged artifact missing: ' + out);
  console.error('  Run: npm run package');
  process.exit(1);
}
ok('Packaged artifact exists: ' + out);

// Step 3: On-disk metadata file exists (build output)
if (!existsSync(metadataFile)) {
  fail('Metadata file missing: ' + metadataFile + ' (run: npm run package)');
  process.exit(1);
}
ok('Metadata file exists: ' + metadataFile);

// Step 4: Read and verify on-disk metadata
let metadata;
try {
  metadata = JSON.parse(readFileSync(metadataFile, 'utf-8'));
} catch (e) {
  fail('Failed to parse metadata file: ' + e.message);
  process.exit(1);
}
ok('Metadata valid');
console.log('  Version: ' + metadata.version);
console.log('  Timestamp: ' + metadata.timestamp);
console.log('  Source commit: ' + (metadata.source_commit && metadata.source_commit !== 'unknown' ? metadata.source_commit.substring(0, 8) : 'unknown'));
console.log('  Build commit: ' + (metadata.build_commit && metadata.build_commit !== 'unknown' ? metadata.build_commit.substring(0, 8) : 'unknown'));

// Step 5: Verify critical files exist in source
const criticalFiles = [
  'SKILL.md',
  'configuration.md',
  'mark-done.md',
  'references/invariants.md',
  'references/configuration-schema.md',
  'templates/README.md',
  'templates/idea-feature.md',
  'templates/bug-report.md',
  'templates/refactor.md',
  'templates/change-review.md',
  'templates/release-review.md',
  'templates/finding.md',
  'examples/README.md',
  'examples/minimal-project.md',
  'examples/standard-team.md',
  'examples/strict-enterprise.md',
  'advanced/README.md',
  'advanced/release-reconciliation.md',
  'advanced/multi-project-scope.md',
];

console.log('\nVerifying critical files in source:');
for (const file of criticalFiles) {
  if (existsSync(join(src, file))) ok(file);
  else fail('missing in source: ' + file);
}

// Step 6: metadata.json MUST be embedded in the artifact (required, not optional)
console.log('\nVerifying embedded metadata.json in artifact:');
if (!commandExists('unzip')) {
  fail('unzip is required to verify the artifact');
  process.exit(1);
}
let embeddedMeta = null;
const metaTmp = mkdtempSync(join(tmpdir(), 'lw-meta-'));
try {
  execSync(`unzip -o -q "${out}" metadata.json -d "${metaTmp}"`, { stdio: 'ignore' });
  const embeddedPath = join(metaTmp, 'metadata.json');
  if (!existsSync(embeddedPath)) {
    fail('metadata.json is not embedded in the artifact (required). Run: npm run package');
  } else {
    try {
      embeddedMeta = JSON.parse(readFileSync(embeddedPath, 'utf-8'));
      ok('metadata.json embedded and valid in artifact');
    } catch (e) {
      fail('embedded metadata.json is not valid JSON: ' + e.message);
    }
  }
} finally {
  rmSync(metaTmp, { recursive: true, force: true });
}
if (embeddedMeta) {
  if (embeddedMeta.version !== metadata.version) {
    fail(`embedded metadata version (${embeddedMeta.version}) != on-disk metadata version (${metadata.version})`);
  } else {
    ok('embedded metadata version matches build metadata');
  }
  if (!embeddedMeta.sourceHash) fail('embedded metadata missing sourceHash');
  else ok('embedded metadata carries sourceHash');
}

// Step 7: Verify critical files exist in artifact
console.log('\nVerifying critical files in artifact:');
for (const file of criticalFiles) {
  const zipPath = 'plane-workflow/' + file;
  try {
    execSync(`unzip -l "${out}" "${zipPath}" > /dev/null 2>&1`);
    ok(file);
  } catch (e) {
    fail('missing in artifact: ' + file);
  }
}

// Step 8: Simulate a real install into an independent runtime and verify parity
console.log('\nSimulating install into independent runtime:');
const runtime = mkdtempSync(join(tmpdir(), 'lw-runtime-')); // true temp runtime
try {
  execSync(`unzip -o -q "${out}" -d "${runtime}"`, { stdio: 'ignore' });

  // Runtime dir layout check: the skill must be installed under plane-workflow/
  const runtimeSkill = join(runtime, 'plane-workflow');
  if (!existsSync(runtimeSkill)) {
    fail('skill not installed under plane-workflow/ in runtime');
  } else {
    ok('skill installed at plane-workflow/ in runtime');

    // All critical files present in the installed runtime
    let runtimeMissing = 0;
    for (const file of criticalFiles) {
      if (!existsSync(join(runtimeSkill, file))) {
        fail('missing in runtime install: ' + file);
        runtimeMissing++;
      }
    }
    if (runtimeMissing === 0) ok('all critical files present in runtime install');

    // Recompute a fresh checksum of the installed runtime and compare to stored sourceHash
    const runtimeHash = generateDirectoryHash(runtimeSkill);
    if (metadata.sourceHash && runtimeHash !== metadata.sourceHash) {
      fail(`runtime checksum (${runtimeHash}) != stored sourceHash (${metadata.sourceHash})`);
    } else {
      ok('runtime checksum matches stored sourceHash: ' + runtimeHash);
    }

    // Drift detection: modifying the runtime must change the checksum.
    const probe = join(runtimeSkill, 'SKILL.md');
    if (existsSync(probe)) {
      const before = generateDirectoryHash(runtimeSkill);
      const original = readFileSync(probe, 'utf-8');
      writeProbe(probe, original + '\n<!-- drift probe -->\n');
      const after = generateDirectoryHash(runtimeSkill);
      restoreProbe(probe, original);
      if (before === after) fail('drift detection failed: runtime checksum did not change after modification');
      else ok('drift detection works: checksum changes after runtime modification');
    }
  }
} finally {
  rmSync(runtime, { recursive: true, force: true });
}

// Step 9: Profile support reported
console.log('\nVerifying Profile support:');
if (metadata.profiles && Array.isArray(metadata.profiles)) {
  for (const profile of metadata.profiles) ok(profile);
} else {
  fail('profile list not available in metadata');
}

// Final report
if (failed) {
  console.error('\n✗ Verification FAILED. Source -> Dist -> Runtime parity NOT verified.');
  process.exit(1);
}
console.log('\n✓ All verification checks passed');
console.log('  Version: ' + metadata.version);
console.log('  Status: Ready for deployment');
console.log('  Source -> Dist -> Runtime parity: VERIFIED');

// Helpers
function generateDirectoryHash(dirPath) {
  const hash = createHash('sha256');
  const files = execSync(
    `find "${dirPath}" -type f -name '*.md' -o -name '*.yaml' -o -name '*.json' | sort`
  ).toString().trim().split('\n');
  for (const file of files) {
    if (!file) continue;
    try {
      hash.update(readFileSync(file, 'utf-8'));
    } catch (e) {
      // ignore unreadable files
    }
  }
  return hash.digest('hex').substring(0, 16);
}

function writeProbe(p, content) {
  writeFileSync(p, content);
}
function restoreProbe(p, content) {
  writeFileSync(p, content);
}

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
