// scripts/execution-context.mjs
//
// PURE helpers for the Layer 2 Execution Context file format (execution_context_v1).
//
// IMPORTANT: This module performs NO Plane I/O and NO filesystem writes. It is a
// test/validation helper only. The actual file read/write and the Workflow Binding
// read/write are Markdown runtime capability contracts executed by the Agent host
// (see plane-workflow/references/execution-context.md). Single-writer, lock-free,
// fail-closed semantics are documented there; this module only models the data.

import crypto from 'crypto';

export const CONTEXT_FORMAT = 'execution_context_v1';

// The only legal context states. Validated structurally (against frontmatter /
// phase fields), never via a whole-file keyword grep, to avoid confusion with
// Plane lifecycle states such as `completed`.
export const CONTEXT_STATE_WORDS = ['prepared', 'active', 'paused', 'abandoned', 'completed'];

// Legal phase statuses (distinct from context states: a phase may be
// `in_progress`, which is NOT a context state).
export const PHASE_STATE_WORDS = ['not_started', 'in_progress', 'completed', 'excepted'];

// Allowed top-level frontmatter keys for execution_context_v1.
const FM_TOP_KEYS = new Set(['format', 'workItem', 'context_status', 'context_revision', 'active_writer', 'plan_hash']);
const FM_ISSUE_KEYS = new Set(['uuid', 'display_id']);

// --- Restricted frontmatter parser (v1 only) -------------------------------

function extractFrontmatter(text) {
  const lines = (text || '').split('\n');
  if (lines[0]?.trim() !== '---') return { ok: false, raw: '' };
  const end = lines.indexOf('---', 1);
  if (end === -1) return { ok: false, raw: '' };
  return { ok: true, raw: lines.slice(1, end).join('\n'), bodyStart: end + 1 };
}

/**
 * Parse the plan.md frontmatter for execution_context_v1.
 * Restricted grammar: only known keys at fixed depth; unknown or duplicate keys
 * fail closed. Nested `workItem:` block allows only uuid/display_id.
 * @throws on any malformed/unrecognized structure
 */
export function parseExecutionContextFrontmatter(text) {
  if (typeof text !== 'string') throw new Error('frontmatter input must be a string');
  const fm = extractFrontmatter(text);
  if (!fm.ok) throw new Error('missing or malformed frontmatter delimiters');
  const data = {};
  const seen = new Set();
  let inWorkItem = false;
  for (const raw of fm.raw.split('\n')) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed) continue;
    const indent = line.length - line.replace(/^\s*/, '').length;
    const colon = trimmed.indexOf(':');
    if (colon === -1) throw new Error(`Invalid frontmatter line: "${trimmed}"`);
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (indent === 0) {
      if (!FM_TOP_KEYS.has(key)) throw new Error(`Unknown frontmatter key '${key}'`);
      if (seen.has(key)) throw new Error(`Duplicate frontmatter key '${key}'`);
      seen.add(key);
      if (key === 'workItem') {
        if (value !== '') throw new Error('workItem must be a nested block');
        inWorkItem = true;
        data.workItem = {};
        continue;
      }
      inWorkItem = false;
      if (key === 'context_revision') {
        const n = Number(value);
        if (!Number.isInteger(n)) throw new Error('context_revision must be an integer');
        data.context_revision = n;
      } else if (key === 'context_status') {
        if (!CONTEXT_STATE_WORDS.includes(value)) throw new Error(`invalid context_status '${value}'`);
        data.context_status = value;
      } else {
        data[key] = value === '' ? null : value;
      }
    } else {
      if (!inWorkItem) throw new Error(`Unexpected nested key '${key}'`);
      if (!FM_ISSUE_KEYS.has(key)) throw new Error(`Unknown workItem key '${key}'`);
      if (key in data.workItem) throw new Error(`Duplicate workItem key '${key}'`);
      data.workItem[key] = value;
    }
  }
  if (data.format !== CONTEXT_FORMAT) throw new Error(`unsupported context format '${data.format}'`);
  if (!data.workItem || typeof data.workItem.uuid !== 'string' || !data.workItem.uuid) {
    throw new Error('frontmatter.workItem.uuid is required');
  }
  if (typeof data.context_revision !== 'number') throw new Error('frontmatter.context_revision must be a number');
  return data;
}

// --- Phase status parser (structured result) -------------------------------

/**
 * Parse the `## Phases` body into a list of { name, status }.
 * Returns a STRUCTURED result so callers can distinguish:
 *   - { ok: false, error: 'unparseable' }  (document shape broken)
 *   - { ok: true, phases }                  (parsed; semantic checks done later)
 * @returns {object} { ok: boolean, phases: object[], error: string|null }
 */
export function parsePhaseStatuses(text) {
  const phases = [];
  const lines = (text || '').split('\n');
  let inPhases = false;
  let current = null;
  for (const line of lines) {
    const h = line.match(/^#{2,}\s+(.*)$/);
    if (h) {
      const title = h[1].trim();
      if (/^phases$/i.test(title)) { inPhases = true; continue; }
      if (inPhases) {
        if (current) phases.push(current);
        current = { name: title, status: null };
      }
      continue;
    }
    const s = line.match(/^status:\s*(.+)$/i);
    if (s && current) {
      current.status = s[1].trim().toLowerCase();
    }
  }
  if (current) phases.push(current);
  if (!inPhases) return { ok: false, phases: [], error: 'unparseable: no ## Phases section' };
  return { ok: true, phases, error: null };
}

// --- Context-status-aware validation ---------------------------------------

/**
 * Validate an Execution Context against its declared context_status.
 * The phase constraint depends on context_status (per v4 correction #3):
 *   - prepared | active : exactly one in_progress phase
 *   - paused            : a pause reason is required (may have 0 or 1 in_progress)
 *   - completed         : zero in_progress; all required phases terminated or excepted
 *   - abandoned         : no completeness required; must not continue implementation
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateExecutionContext({ phases = [], contextStatus, pausedReason = null, requiredPhases = [] }) {
  const errors = [];
  if (!CONTEXT_STATE_WORDS.includes(contextStatus)) {
    return { valid: false, errors: [`invalid context_status '${contextStatus}'`] };
  }
  const inProgress = phases.filter((p) => p.status === 'in_progress');
  if (contextStatus === 'prepared' || contextStatus === 'active') {
    if (inProgress.length !== 1) {
      errors.push(`${contextStatus} requires exactly one in_progress phase (found ${inProgress.length})`);
    }
  } else if (contextStatus === 'paused') {
    if (!pausedReason) errors.push('paused requires a pause reason');
  } else if (contextStatus === 'completed') {
    if (inProgress.length !== 0) errors.push('completed must have zero in_progress phases');
    for (const name of requiredPhases) {
      const ph = phases.find((p) => p.name === name);
      if (!ph) { errors.push(`completed requires phase '${name}' to be present`); continue; }
      if (ph.status !== 'completed' && ph.status !== 'excepted') {
        errors.push(`completed requires phase '${name}' terminated or excepted (found '${ph.status}')`);
      }
    }
  } else if (contextStatus === 'abandoned') {
    // No completeness required; implementation must not continue.
  }
  return { valid: errors.length === 0, errors };
}

// --- Structured context-state vocabulary check -----------------------------

/**
 * Scope-limited vocabulary check: verifies context_status and each phase status
 * are legal context states. This is NOT a whole-file keyword grep.
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateContextStateVocabulary({ contextStatus, phases = [] }) {
  const errors = [];
  if (contextStatus !== undefined && !CONTEXT_STATE_WORDS.includes(contextStatus)) {
    errors.push(`context_status '${contextStatus}' is not a legal context state`);
  }
  for (const p of phases) {
    if (p.status !== null && p.status !== undefined && !PHASE_STATE_WORDS.includes(p.status)) {
      errors.push(`phase '${p.name}' status '${p.status}' is not a legal phase status`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// --- Auto-decision logic (§7.2) ---------------------------------------------

/**
 * Decide whether a newly planned workItem should use an Execution Context.
 * Five triggers; if any fires => enabled. Decision is made ONCE after plan
 * discovery and must not re-evaluate on resume (the Markdown contract stores it).
 * @returns {object} { decision: 'enabled'|'not_needed', reason: string }
 */
export function decideAutoContext(workItem = {}) {
  const reasons = [];
  if (workItem.spansSessions) reasons.push('spans multiple sessions');
  if ((workItem.phaseCount ?? 0) >= 3) reasons.push('>=3 meaningful phases');
  if (workItem.multiModule || workItem.isMigration || workItem.isRollback || workItem.hasUnknowns) {
    reasons.push('multi-module/migration/rollback/unknowns');
  }
  if (workItem.userRequestsTracking) reasons.push('user requested progress tracking');
  if (workItem.unreconstructableInterruption) reasons.push('interrupted and unreconstructable');
  if (reasons.length > 0) return { decision: 'enabled', reason: reasons.join('; ') };
  return { decision: 'not_needed', reason: 'single simple change' };
}

// --- Gitignore verification (table-driven, §7.3) ----------------------------

/**
 * Determine the gitignore verification action for a given mode/state.
 * The skill VERIFIES only; it never edits .gitignore (§3).
 * @returns {object} { action: 'ok'|'init'|'report'|'require_user'|'fail_closed', message: string }
 */
export function checkGitignore({ mode, rootExists, rootIgnored, hasGit }) {
  if (mode === 'disabled') return { action: 'ok', message: 'disabled mode does not create context files' };
  if (!hasGit) return { action: 'report', message: 'git repository not found; ignore status cannot be verified' };
  if (!rootExists) return { action: 'init', message: 'root does not exist; will be created' };
  if (rootIgnored) return { action: 'ok', message: 'root is gitignored' };
  // root exists and is NOT ignored
  if (mode === 'required') return { action: 'fail_closed', message: 'required mode needs an ignored root; root is not gitignored' };
  if (mode === 'auto') return { action: 'require_user', message: 'root is not gitignored; explain risk and require user direction' };
  return { action: 'ok', message: 'root is gitignored' };
}

// --- Content hash + conflict detection (§10.1, v4 correction #5) ------------

/**
 * SHA-256 content hash of a Context file body (UTF-8).
 */
export function computeContentHash(text) {
  return crypto.createHash('sha256').update(typeof text === 'string' ? text : '', 'utf-8').digest('hex');
}

/**
 * Detect a single-writer conflict. A mismatch in EITHER the persisted revision
 * OR the last-observed plan hash is a conflict. mtime is NEVER an input here —
 * it is diagnostic only (v4 correction: mtime alone never triggers a conflict).
 * @returns {boolean}
 */
export function detectContextConflict({ observedRevision, storedRevision, observedHash, storedHash }) {
  if (observedRevision !== storedRevision) return true;
  if (observedHash !== storedHash) return true;
  return false;
}

// --- Redaction helper (best-effort, §8.3 / §15.15) --------------------------

/**
 * Best-effort redaction of credential-like tokens and personal absolute paths.
 * Defense-in-depth only; the authoritative source of truth must never contain
 * secrets in the first place.
 */
export function redactSensitive(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/(ghp|github_pat)_[A-Za-z0-9]{20,}/g, '<REDACTED_TOKEN>')
    .replace(/AKIA[0-9A-Z]{16}/g, '<REDACTED_AWS_KEY>')
    .replace(/sk-[A-Za-z0-9]{20,}/g, '<REDACTED_OPENAI_KEY>')
    .replace(/\/Users\/[^\/\s]+/g, '<REDACTED_HOME>')
    .replace(/\/home\/[^\/\s]+/g, '<REDACTED_HOME>')
    .replace(/C:\\Users\\[^\s]+/g, '<REDACTED_HOME>');
}

// --- Context state machine (§9) ---------------------------------------------

// Legal transitions between context states. `completed` and `abandoned` are terminal.
export const LEGAL_TRANSITIONS = {
  prepared: ['active', 'abandoned'],
  active: ['paused', 'completed', 'abandoned'],
  paused: ['active', 'abandoned'],
  completed: [],
  abandoned: [],
};

/**
 * Whether a context-state transition is legal.
 */
export function canTransition(from, to) {
  if (from === to) return true;
  const allowed = LEGAL_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

// --- Lifecycle model primitives (runtime contract building blocks) ---------

/**
 * Detect a ghost branch: a local working branch with no known counterpart.
 * @returns {boolean}
 */
export function detectGhostBranch({ localBranch, knownBranches = [] }) {
  if (!localBranch) return false;
  return !knownBranches.includes(localBranch);
}

/**
 * Resolve a candidate context by immutable workItem UUID, ignoring any stale
 * display id (workItem-key change must NOT trigger an auto-rename).
 * @returns {object|null}
 */
export function resolveContextByUuid(candidates = [], workItemUuid) {
  return candidates.find((c) => c && c.workitem_uuid === workItemUuid) || null;
}

/**
 * Classify candidate contexts for resume selection.
 * @returns {object} { count, requireSelection }
 */
export function classifyCandidates(candidates = []) {
  const count = candidates.length;
  return { count, requireSelection: count > 1 };
}

/**
 * Extract findings from a findings.md body. Findings are working memory ONLY;
 * they can never carry governance fields (authorization / config / review / done).
 * This function deliberately returns a plain list of strings and performs no
 * governance mutation — injection immunity is structural, not heuristic.
 * @returns {string[]}
 */
export function extractFindings(text) {
  const findings = [];
  const lines = (text || '').split('\n');
  let inFindings = false;
  for (const line of lines) {
    const h = line.match(/^#{1,}\s*(.*)$/);
    if (h && /findings/i.test(h[1].trim())) { inFindings = true; continue; }
    if (h) { inFindings = false; continue; }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (inFindings && bullet) findings.push(bullet[1].trim());
  }
  return findings;
}
