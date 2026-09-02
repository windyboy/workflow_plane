#!/usr/bin/env node
// scripts/validate.mjs
//
// Single local validation entry point for the plane-workflow skill.
// Runs static consistency checks and the behavior scenario tests, then exits
// non-zero if any check fails. Designed to be the one documented command
// (`npm run validate`) and to run in CI for pull requests and the default
// branch.
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { IDENTIFIER_PATTERN, VALID_STATE_TYPES, NON_STATE_WORDS } from './policy.mjs';
import { getSchema } from './profile-parser.mjs';
import { runBehaviorTests } from './behavior.test.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = join(root, 'plane-workflow');
const dist = join(root, 'dist', 'plane-workflow.skill');
const agents = join(root, 'AGENTS.md');

let failures = 0;
const fail = (m) => { console.error('  FAIL: ' + m); failures++; };
const ok = (m) => console.log('  ok:   ' + m);
const group = (name) => console.log('\n== ' + name + ' ==');

// --- 1. Skill frontmatter and name/directory conventions -------------------
group('Skill frontmatter and conventions');
{
  const sk = join(skillDir, 'SKILL.md');
  if (!existsSync(sk)) {
    fail('plane-workflow/SKILL.md missing');
  } else {
    const fm = parseFrontmatter(readFileSync(sk, 'utf8'));
    if (!fm) {
      fail('SKILL.md has no valid YAML frontmatter block');
    } else {
      if (!fm.name) fail('frontmatter missing required "name"');
      else if (fm.name !== 'plane-workflow') fail(`frontmatter name "${fm.name}" != "plane-workflow"`);
      else ok('frontmatter name is "plane-workflow"');
      if (!fm.description) fail('frontmatter missing required "description"');
      else ok('frontmatter has description');
      // skills CLI (bunx skills install) rejects unquoted scalars that contain `:`.
      const descRaw = frontmatterFieldRaw(readFileSync(sk, 'utf8'), 'description');
      if (descRaw && !isYamlQuotedScalar(descRaw) && descRaw.includes(':')) {
        fail('frontmatter description has an unquoted colon (quote the YAML value)');
      } else if (fm.description) {
        ok('frontmatter description is YAML-safe');
      }
      // Directory convention: the skill directory basename must match the name.
      if (basename(skillDir) !== fm.name) fail(`skill directory "${basename(skillDir)}" != frontmatter name "${fm.name}"`);
      else ok('skill directory matches frontmatter name');
    }
  }
  if (!existsSync(join(skillDir, 'mark-done.md'))) fail('plane-workflow/mark-done.md missing');
  else ok('plane-workflow/mark-done.md present');
  if (!existsSync(join(skillDir, 'templates'))) fail('templates missing');
  else ok('templates present');
  if (!existsSync(join(skillDir, 'templates', 'README.md'))) fail('templates/README.md missing');
  else ok('templates/README.md present');
  if (!existsSync(join(skillDir, 'configuration.md'))) fail('configuration.md missing');
  else ok('configuration.md present');
  if (!existsSync(join(skillDir, 'references', 'invariants.md'))) fail('references/invariants.md missing');
  else ok('references/invariants.md present');
  if (!existsSync(join(skillDir, 'references', 'configuration-schema.md'))) fail('references/configuration-schema.md missing');
  else ok('references/configuration-schema.md present');
}

// --- 2. Relative Markdown links --------------------------------------------
group('Relative Markdown links');
{
  const mdFiles = collect(skillDir).filter((f) => f.endsWith('.md'));
  let checked = 0;
  for (const rel of mdFiles) {
    const text = readFileSync(join(skillDir, rel), 'utf8');
    const links = [...text.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)].map((m) => m[1]);
    for (const link of links) {
      const base = dirname(join(skillDir, rel));
      const target = resolve(base, link);
      if (!existsSync(target)) fail(`broken link ${link} in plane-workflow/${rel}`);
      checked++;
    }
  }
  if (checked === 0) fail('no relative .md links found to verify');
  else ok(`${checked} relative Markdown link(s) resolve`);
}

// --- 3. Referenced repository paths ----------------------------------------
group('Referenced repository paths');
{
  if (!existsSync(agents)) {
    fail('AGENTS.md missing');
  } else {
    const text = readFileSync(agents, 'utf8');
    if (!/plane-workflow\//.test(text)) fail('AGENTS.md does not reference plane-workflow/');
    else if (!existsSync(skillDir)) fail('referenced plane-workflow/ does not exist');
    else ok('AGENTS.md references existing plane-workflow/');
    if (/`\.forge\/skills\/plane-workflow\//.test(text)) {
      const p = join(root, '.forge', 'skills', 'plane-workflow');
      if (!existsSync(p)) fail('.forge/skills/plane-workflow/ referenced but missing');
      else ok('.forge install path exists');
    }
  }
}

// --- 4. Plane state-type literals -----------------------------------------
group('Plane state-type literals');
{
  const files = ['SKILL.md', 'mark-done.md'].map((f) => join(skillDir, f)).filter(existsSync);
  const tokens = new Set();
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/`[a-z]+`/g)) tokens.add(m[0].slice(1, -1));
  }
  let unknown = 0;
  for (const tok of tokens) {
    if (VALID_STATE_TYPES.has(tok) || NON_STATE_WORDS.has(tok)) continue;
    console.error('  unknown state-type literal: ' + tok);
    unknown++;
  }
  if (unknown) fail(`${unknown} unknown state-type literal(s)`);
  else ok('all backtick lowercase state-type literals are valid');
  // Regression guard: the historical invalid literal must never reappear.
  const allText = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  if (/\btried\b/.test(allText)) fail("invalid state-type literal 'tried' present (use 'triage')");
  else ok("no invalid 'tried' literal");
}

// --- 5. Canonical identifier extraction/validation policy ------------------
group('Canonical identifier policy');
{
  const files = ['SKILL.md', 'mark-done.md'].map((f) => join(skillDir, f)).filter(existsSync);
  let found = 0;
  for (const f of files) {
    if (readFileSync(f, 'utf8').includes(IDENTIFIER_PATTERN)) found++;
    else fail(`canonical identifier regex not found in ${relative(root, f)}`);
  }
  if (found === 0) fail('canonical identifier regex absent from skill docs');
  else ok(`canonical identifier regex present in ${found} doc file(s) (matches policy.mjs)`);
}

// --- 6. Packaged source/dist parity and staleness --------------------------
group('Packaged artifact (dist) parity and staleness');
{
  if (!existsSync(dist)) {
    fail(`dist artifact missing: ${relative(root, dist)} (run "npm run package")`);
  } else if (!commandExists('unzip')) {
    ok('unzip unavailable; skipped dist parity check');
  } else {
    const tmp = mkdtempSync(join(tmpdir(), 'lw-skill-'));
    try {
      execSync(`unzip -o -q "${dist}" -d "${tmp}"`, { stdio: 'ignore' });
      const srcFiles = collect(skillDir).map((r) => 'plane-workflow/' + r);
      const distFiles = collect(join(tmp, 'plane-workflow')).map((r) => 'plane-workflow/' + r);
      const srcSet = new Set(srcFiles);
      const distSet = new Set(distFiles);
      for (const f of srcFiles) if (!distSet.has(f)) fail(`source file missing from dist: ${f}`);
      for (const f of distFiles) if (!srcSet.has(f)) fail(`dist file not in source: ${f}`);
      for (const f of srcFiles) {
        if (!distSet.has(f)) continue;
        if (sha(join(root, f)) === sha(join(tmp, f))) ok(`parity: ${f}`);
        else fail(`stale/mismatched content: ${f} (rebuild with "npm run package")`); // staleness
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
}

// --- 6b. Generated .forge runtime copy parity ------------------------------
group('Generated .forge runtime copy parity');
{
  const forgeSkill = join(root, '.forge', 'skills', 'plane-workflow');
  if (!existsSync(forgeSkill)) {
    fail(`.forge/skills/plane-workflow/ missing (run "npm run sync:forge")`);
  } else {
    const srcFiles = collect(skillDir);
    const forgeFiles = collect(forgeSkill);
    const srcSet = new Set(srcFiles);
    const forgeSet = new Set(forgeFiles);
    for (const f of srcFiles) if (!forgeSet.has(f)) fail(`source file missing from .forge copy: ${f}`);
    for (const f of forgeFiles) if (!srcSet.has(f)) fail(`.forge copy has stale file not in source: ${f}`);
    let drift = 0;
    for (const f of srcFiles) {
      if (!forgeSet.has(f)) continue;
      if (sha(join(skillDir, f)) !== sha(join(forgeSkill, f))) {
        fail(`drift: ${f} differs between plane-workflow/ and .forge copy`);
        drift++;
      }
    }
    if (drift === 0) ok('.forge copy is byte-for-byte identical to plane-workflow/');
  }
}

// --- 7. Behavior scenario tests --------------------------------------------
group('Behavior scenario tests');
{
  const { passed, failed, total } = runBehaviorTests();
  if (failed) fail(`${failed}/${total} behavior scenario(s) failed`);
  else ok(`${passed}/${total} behavior scenario(s) passed`);
}

// --- 8. configuration-schema.md ↔ programmatic schema parity ---------------
// getSchema() is the single source of truth; generate-schema.mjs writes its
// output into the markdown, and this check asserts the committed markdown is
// byte-for-byte equivalent (after key normalization) so the two can never drift
// into a third, hand-maintained definition.
group('configuration-schema.md ↔ getSchema() parity');
{
  const docPath = join(skillDir, 'references', 'configuration-schema.md');
  if (!existsSync(docPath)) {
    fail('configuration-schema.md missing');
  } else {
    const text = readFileSync(docPath, 'utf8');
    const m = text.match(/<!-- SCHEMA:START -->[\s\S]*?```json\n([\s\S]*?)\n```/);
    if (!m) {
      fail('configuration-schema.md has no generated JSON schema block');
    } else {
      let docSchema;
      try {
        docSchema = JSON.parse(m[1]);
      } catch (e) {
        fail('configuration-schema.md JSON schema is not valid JSON: ' + e.message);
      }
      if (docSchema) {
        const codeSchema = getSchema();
        const docStr = stableStringify(docSchema);
        const codeStr = stableStringify(codeSchema);
        if (docStr === codeStr) ok('configuration-schema.md matches getSchema() (full deep compare)');
        else fail('configuration-schema.md drifted from getSchema(); run "npm run sync:schema"\n  doc : ' + docStr + '\n  code: ' + codeStr);
      }
    }
  }
}

// --- Summary ----------------------------------------------------------------
console.log('');
if (failures) {
  console.error(`${failures} validation check(s) failed.`);
  process.exit(1);
}
console.log('All skill validation checks passed.');

// --- Helpers ----------------------------------------------------------------
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (mm) fm[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
  }
  return fm;
}

function frontmatterFieldRaw(text, field) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const line = m[1].split('\n').find((l) => l.startsWith(field + ':'));
  if (!line) return null;
  return line.slice(field.length + 1).trim();
}

function isYamlQuotedScalar(value) {
  return (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
}

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

function sha(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

// Recursively sort object keys so two logically-equal schemas compare equal
// regardless of key ordering in source/markdown.
function stableStringify(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function commandExists(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
