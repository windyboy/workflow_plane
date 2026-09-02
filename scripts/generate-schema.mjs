#!/usr/bin/env node
// scripts/generate-schema.mjs
//
// Regenerates the JSON Schema block inside
// `plane-workflow/references/configuration-schema.md` from the single source
// of truth `getSchema()` in profile-parser.mjs. The markdown block is wrapped in
// `<!-- SCHEMA:START -->` / `<!-- SCHEMA:END -->` markers; this script replaces
// everything between the markers with the current schema.
//
// Run `npm run sync:schema` after changing getSchema(). `scripts/validate.mjs`
// then asserts the committed markdown matches getSchema() so the generated copy
// can never silently drift.
//
// Usage: node scripts/generate-schema.mjs [--check]
//   --check  Exit non-zero if the markdown does not match getSchema() (no write).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSchema } from './profile-parser.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docPath = join(root, 'plane-workflow', 'references', 'configuration-schema.md');

const START = '<!-- SCHEMA:START -->';
const END = '<!-- SCHEMA:END -->';
const checkOnly = process.argv.includes('--check');

if (!existsSync(docPath)) {
  console.error('doc missing: ' + docPath);
  process.exit(1);
}

const block = `${START}\n\n\`\`\`json\n${JSON.stringify(getSchema(), null, 2)}\n\`\`\`\n\n${END}`;

const text = readFileSync(docPath, 'utf8');
const re = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!re.test(text)) {
  console.error('SCHEMA markers not found in ' + docPath);
  process.exit(1);
}

const current = text.match(re)[0];
if (current === block) {
  console.log('✓ configuration-schema.md schema block already in sync with getSchema()');
  process.exit(0);
}

if (checkOnly) {
  console.error('✗ configuration-schema.md schema block is out of sync with getSchema()');
  console.error('  Run: npm run sync:schema');
  process.exit(1);
}

writeFileSync(docPath, text.replace(re, block));
console.log('✓ regenerated configuration-schema.md schema block from getSchema()');
