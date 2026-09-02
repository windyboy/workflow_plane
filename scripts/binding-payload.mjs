// scripts/binding-payload.mjs
//
// PURE helper for the Layer 1 Workflow Binding payload.
//
// IMPORTANT: This module performs NO Plane I/O. It does not call MCP/API or
// any host runtime. It only (de)serializes, validates, fingerprints, and builds
// fixture scenarios for the Binding payload. The actual read/write/read-back of
// a Binding against Plane is a Markdown runtime capability contract executed by
// the Agent host (see plane-workflow/references/execution-context.md).

import crypto from 'crypto';

export const BINDING_SCHEMA_VERSION = 'execution_binding_v1';

// The `auto` mode records both the configured mode and the per-workItem decision.
export const CONTEXT_DECISION = ['enabled', 'not_needed'];

// The frozen strategy keys a binding must capture (all six — never a subset).
export const RESOLVED_STRATEGY_KEYS = [
  'plan_confirmation',
  'review_gate',
  'completion_gate',
  'audit_comments',
  'release_reconciliation',
  'output_verbosity',
];

// Deterministic canonical JSON with fixed key ordering (recursive sort).
function canonicalJSON(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(obj).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`);
  return '{' + entries.join(',') + '}';
}

/**
 * Compute the deterministic integrity fingerprint of a frozen binding payload.
 *
 * Algorithm (fixed, host-agnostic):
 *   payload_fingerprint = SHA-256( UTF-8( canonicalJSON( frozen_payload
 *       WITHOUT bound_at AND WITHOUT payload_fingerprint ) ) )
 *
 * NOTE: this provides deterministic integrity and duplicate-consistency checking.
 * It does NOT provide authenticity or tamper-proofing — anyone who can write the
 * comment can recompute the hash. Authenticity would require a signature /
 * protected metadata, which is out of scope for v0.5.
 *
 * @param {object} frozenPayload - The binding payload (with bound_at present)
 * @returns {string} hex SHA-256 digest
 */
export function computeFingerprint(frozenPayload) {
  const { bound_at, payload_fingerprint, ...rest } = frozenPayload;
  return crypto.createHash('sha256').update(canonicalJSON(rest), 'utf-8').digest('hex');
}

/**
 * Validate a binding payload structure (fail closed).
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateBinding(payload) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { valid: false, errors: ['Binding must be an object'] };
  }
  if (payload.schema_version !== BINDING_SCHEMA_VERSION) {
    errors.push(`Invalid schema_version '${payload.schema_version}' (expected ${BINDING_SCHEMA_VERSION})`);
  }
  if (payload.workitem_uuid !== undefined && (typeof payload.workitem_uuid !== 'string' || !payload.workitem_uuid)) {
    errors.push('Binding.workitem_uuid must be a non-empty string when provided');
  }
  if (typeof payload.workitem_identifier !== 'string' || !payload.workitem_identifier) {
    errors.push('Binding.workitem_identifier must be a non-empty string');
  }
  if (typeof payload.project_id !== 'string' || !payload.project_id) {
    errors.push('Binding.project_id must be a non-empty string');
  }
  if (payload.configured_mode !== undefined && !['disabled', 'auto', 'required'].includes(payload.configured_mode)) {
    errors.push(`Invalid configured_mode '${payload.configured_mode}'`);
  }
  if (payload.context_decision !== undefined && !CONTEXT_DECISION.includes(payload.context_decision)) {
    errors.push(`Invalid context_decision '${payload.context_decision}'`);
  }
  const rs = payload.resolved_strategies;
  if (!rs || typeof rs !== 'object' || Array.isArray(rs)) {
    errors.push('Binding.resolved_strategies must be an object capturing all six strategy items');
  } else {
    for (const key of RESOLVED_STRATEGY_KEYS) {
      if (!(key in rs)) errors.push(`Binding.resolved_strategies missing '${key}'`);
    }
    for (const key of Object.keys(rs)) {
      if (!RESOLVED_STRATEGY_KEYS.includes(key)) errors.push(`Binding.resolved_strategies has unknown key '${key}'`);
    }
  }
  if (!payload.execution_context || typeof payload.execution_context !== 'object' || Array.isArray(payload.execution_context)) {
    errors.push('Binding.execution_context must be an object');
  }
  if (typeof payload.payload_fingerprint !== 'string' || !payload.payload_fingerprint) {
    errors.push('Binding.payload_fingerprint must be a non-empty string');
  } else {
    const expected = computeFingerprint(payload);
    if (payload.payload_fingerprint !== expected) {
      errors.push('Binding.payload_fingerprint does not match frozen payload');
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Build a complete, fingerprinted binding payload from inputs.
 */
export function buildBinding({
  workItemUuid,
  workItemIdentifier,
  projectId,
  profile,
  resolvedStrategies,
  executionContext,
  configuredMode,
  contextDecision,
  boundAt,
}) {
  const frozen = {
    schema_version: BINDING_SCHEMA_VERSION,
    ...(workItemUuid ? { workitem_uuid: workItemUuid } : {}),
    workitem_identifier: workItemIdentifier || workItemUuid,
    project_id: projectId,
    profile,
    resolved_strategies: resolvedStrategies,
    execution_context: executionContext,
    configured_mode: configuredMode,
    context_decision: contextDecision,
    bound_at: boundAt || new Date().toISOString(),
  };
  frozen.payload_fingerprint = computeFingerprint(frozen);
  return frozen;
}

// Machine-readable comment envelope delimiters (stable, for de-dup / forge detection).
const ENVELOPE_START = '---plane-workflow-binding---';
const ENVELOPE_END = '---end-plane-workflow-binding---';

/**
 * Serialize a binding payload to the stable machine-readable comment envelope.
 * @throws if the payload is invalid
 */
export function serializeBinding(payload) {
  const v = validateBinding(payload);
  if (!v.valid) throw new Error('Cannot serialize invalid binding: ' + v.errors.join('; '));
  const lines = [ENVELOPE_START];
  for (const key of Object.keys(payload).sort()) {
    const val = payload[key];
    lines.push(`${key}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
  }
  lines.push(ENVELOPE_END);
  return lines.join('\n');
}

/**
 * Parse a binding envelope back from text. Returns null if no envelope present.
 */
export function parseBinding(text) {
  if (typeof text !== 'string') return null;
  const start = text.indexOf(ENVELOPE_START);
  const end = text.indexOf(ENVELOPE_END);
  if (start === -1 || end === -1 || end < start) return null;
  const body = text.slice(start + ENVELOPE_START.length, end).trim();
  const payload = {};
  for (const line of body.split('\n')) {
    const idx = line.indexOf(': ');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 2).trim();
    if (val.startsWith('{') || val.startsWith('[')) {
      try { val = JSON.parse(val); } catch { /* keep as string */ }
    }
    payload[key] = val;
  }
  return payload;
}

/**
 * Classify a set of bindings for a work item: 0 / 1 / >1 matches by workitem_uuid.
 * Used by the runtime resolution algorithm (the Markdown contract decides behavior).
 * @returns {object} { count: 0|1|>1, matches: object[] }
 */
export function classifyBindings(bindings, workItemIdentity) {
  const all = (bindings || []).filter(Boolean);
  // When the Plane MCP exposes no immutable UUID, comments are already scoped
  // to one workItem by the MCP list-comments call. Do not pretend a display ID is
  // immutable; classify every Binding returned from that verified comment scope.
  if (workItemIdentity && typeof workItemIdentity === 'object' && workItemIdentity.commentScoped) {
    return { count: all.length, matches: all };
  }
  const workItemUuid = typeof workItemIdentity === 'string' ? workItemIdentity : workItemIdentity?.workItemUuid;
  const workItemIdentifier = typeof workItemIdentity === 'object' ? workItemIdentity.workItemIdentifier : undefined;
  const matches = all.filter((b) =>
    (workItemUuid && b.workitem_uuid === workItemUuid) || (!workItemUuid && workItemIdentifier && b.workitem_identifier === workItemIdentifier),
  );
  if (matches.length <= 1) return { count: matches.length, matches };
  return { count: matches.length, matches };
}

/**
 * Verify a single binding matches the expected frozen payload + fingerprint.
 * @returns {object} { ok: boolean, reason?: string }
 */
export function verifyBinding(payload, expected) {
  if (!expected || !validateBinding(expected).valid) {
    return { ok: false, reason: 'expected binding is invalid' };
  }
  const validation = validateBinding(payload);
  if (!validation.valid) {
    return { ok: false, reason: validation.errors.join('; ') };
  }
  if (expected.workitem_uuid && payload.workitem_uuid !== expected.workitem_uuid) {
    return { ok: false, reason: 'workitem_uuid mismatch' };
  }
  if (!expected.workitem_uuid && payload.workitem_identifier !== expected.workitem_identifier) {
    return { ok: false, reason: 'workitem_identifier mismatch' };
  }
  if (payload.schema_version !== expected.schema_version) {
    return { ok: false, reason: 'schema_version mismatch' };
  }
  if (payload.payload_fingerprint !== expected.payload_fingerprint) {
    return { ok: false, reason: 'payload_fingerprint mismatch (frozen payload)' };
  }
  return { ok: true };
}
