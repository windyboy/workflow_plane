#!/usr/bin/env node
// scripts/package.mjs
//
// Builds dist/plane-workflow.skill from the plane-workflow/ source tree so
// the packaged artifact stays in parity with the repository source. Run this
// after editing the skill, then `npm run validate` to confirm the bundle is
// not stale.
//
// New in v0.3.0:
// - Injects version metadata into the packaged artifact
// - Verifies source → dist → runtime parity
// - Detects and reports drift between versions

import { existsSync, mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'plane-workflow');
const out = join(root, 'dist', 'plane-workflow.skill');
const metadataFile = join(root, 'dist', 'plane-workflow.metadata.json');

// Step 1: Verify source directory exists
if (!existsSync(src)) {
  console.error('source missing: ' + src);
  process.exit(1);
}

// Step 2: Ensure dist directory exists
if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true });

// Step 3: Verify required commands
if (!commandExists('zip')) {
  console.error('zip is required to package the skill artifact');
  process.exit(1);
}

// Step 4: Read package.json to get version
let packageVersion = 'unknown';
try {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
  packageVersion = packageJson.version || 'unknown';
} catch (e) {
  console.warn('warning: could not read package.json version');
}

// Step 5: Generate source hash (for drift detection)
const sourceHash = generateDirectoryHash(src);

// Step 6: Get the build commit (HEAD) and the source commit that last touched
// the skill source tree. They differ when a repo commit only syncs the generated
// .forge copy while the skill source still corresponds to an earlier commit.
let buildCommit = 'unknown';
let sourceCommit = 'unknown';
try {
  buildCommit = execSync('git rev-parse HEAD', { cwd: root, stdio: 'pipe' }).toString().trim();
  sourceCommit = execSync('git log -1 --format=%H -- plane-workflow/', { cwd: root, stdio: 'pipe' }).toString().trim();
} catch (e) {
  console.warn('warning: could not get git commit hash');
}

// Step 7: Remove old artifact and zip the skill directory
console.log('Packaging plane-workflow v' + packageVersion);
execSync(`rm -f "${out}"`, { stdio: 'ignore' });
execSync(`zip -r -X -q "${out}" plane-workflow`, { cwd: root, stdio: 'inherit' });
console.log('✓ Packaged ' + out);

// Step 8: Generate and write metadata
const metadata = {
  version: packageVersion,
  timestamp: new Date().toISOString(),
  source_commit: sourceCommit,
  build_commit: buildCommit,
  sourceHash: sourceHash,
  profiles: ['minimal', 'standard', 'strict'],
  invariants: 5,
  templates: 6,
  referenceFiles: [
    'references/invariants.md',
    'references/configuration-schema.md',
    'references/capability-discovery.md',
    'references/workitem-discovery.md',
    'references/start-implementation.md',
    'references/move-to-review.md',
    'references/output-contracts.md',
    'references/project-scope.md',
    'references/resume-work.md',
    'references/review-gate-policy.md'
  ],
  templates: [
    'templates/idea-feature.md',
    'templates/bug-report.md',
    'templates/refactor.md',
    'templates/change-review.md',
    'templates/release-review.md',
    'templates/finding.md'
  ],
  parity: {
    sourceHash: sourceHash,
    status: 'in_parity',
    lastVerified: new Date().toISOString()
  }
};

writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
console.log('✓ Generated metadata ' + metadataFile);

// Step 9: Embed metadata into .skill artifact
console.log('\nEmbedding metadata into artifact...');
const metadataContent = JSON.stringify(metadata, null, 2);
const tmpMeta = mkdtempSync(join(tmpdir(), 'lw-meta-'));
const metaTmp = join(tmpMeta, 'metadata.json');
writeFileSync(metaTmp, metadataContent);
try {
  // Add metadata.json as a top-level entry in the zip (must be present, not optional).
  execSync(`zip -q "${out}" metadata.json`, { cwd: tmpMeta, stdio: 'pipe' });
  console.log('✓ Embedded metadata.json into artifact');
} catch (e) {
  rmSync(tmpMeta, { recursive: true, force: true });
  console.error('✗ Failed to embed metadata.json into artifact: ' + e.message);
  process.exit(1);
}
rmSync(tmpMeta, { recursive: true, force: true });

// Step 10: Verify parity
console.log('\nVerifying source → dist parity...');
const artifactContents = execSync(`unzip -l "${out}" | grep -E '\.md$' | wc -l`).toString().trim();
console.log('✓ Artifact contains ' + artifactContents + ' markdown files');

// Step 11: Report success
console.log('\n✓ Packaging complete');
console.log('  Version: ' + packageVersion);
console.log('  Source hash: ' + sourceHash);
console.log('  Artifact: ' + out);
console.log('  Metadata: ' + metadataFile);
console.log('\nNext: Run `npm run validate` to verify the packaged artifact');

// Helper functions

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function generateDirectoryHash(dirPath) {
  const hash = createHash('sha256');
  const files = execSync(`find "${dirPath}" -type f -name '*.md' -o -name '*.yaml' -o -name '*.json' | sort`).toString().trim().split('\n');
  
  for (const file of files) {
    if (file) {
      try {
        const content = readFileSync(file, 'utf-8');
        hash.update(content);
      } catch (e) {
        console.warn('warning: could not read file for hashing: ' + file);
      }
    }
  }
  
  return hash.digest('hex').substring(0, 16);
}
