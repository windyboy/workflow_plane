// scripts/profile-parser.mjs
//
// Profile configuration parser and validator.
// Handles YAML/JSON configuration files, applies overrides, and validates against schema.

import fs from 'fs';
import path from 'path';

// Default Profile configurations
export const PROFILE_DEFAULTS = {
  minimal: {
    plan_confirmation: 'implicit',
    review_gate: 'pr_ready',
    completion_gate: 'release_confirmed',
    audit_comments: 'none',
    release_reconciliation: 'disabled',
    output_verbosity: 'minimal',
  },
  standard: {
    plan_confirmation: 'risk_based',
    review_gate: 'pr_ready',
    completion_gate: 'release_confirmed',
    audit_comments: 'summary',
    release_reconciliation: 'on_request',
    output_verbosity: 'standard',
  },
  strict: {
    plan_confirmation: 'explicit',
    review_gate: 'user_acceptance',
    completion_gate: 'production_deployment',
    audit_comments: 'detailed',
    release_reconciliation: 'enabled',
    output_verbosity: 'detailed',
  },
};

// Valid values for each strategy item
export const STRATEGY_SCHEMA = {
  plan_confirmation: ['implicit', 'risk_based', 'explicit'],
  review_gate: ['pr_ready', 'user_acceptance'],
  completion_gate: ['release_confirmed', 'production_deployment', 'manual'],
  audit_comments: ['none', 'summary', 'detailed'],
  release_reconciliation: ['disabled', 'on_request', 'enabled'],
  output_verbosity: ['minimal', 'standard', 'detailed'],
};

// Execution Context (Layer 2) configuration.
// IMPORTANT: this is intentionally INDEPENDENT of the six Profile strategy
// items above. It is NOT a strategy item and is never merged by mergeConfig().
export const EXECUTION_CONTEXT_SCHEMA = {
  mode: ['disabled', 'auto', 'required'],
  format: ['execution_context_v1'],
  DEFAULT_ROOT: '.agent-work',
  DEFAULT_FORMAT: 'execution_context_v1',
};

// Invariants that cannot be overridden
export const PROTECTED_INVARIANTS = {
  read_before_write: true,
  write_back_verification: true,
  authorization_required: true,
  project_boundary: true,
  reality_check: true,
};

/**
 * Parse configuration from YAML/JSON file or object.
 * Missing config file => default `standard` (allowed, not an error).
 * A config file that EXISTS but is invalid => throws (fail closed).
 * @param {string|object} configPath - Path to config file or config object
 * @returns {object} Parsed configuration { profile, overrides }
 */
export function parseConfig(configPath) {
  if (typeof configPath === 'object' && configPath !== null) {
    return validateOrThrow(configPath);
  }
  if (typeof configPath !== 'string') {
    return { version: 1, profile: 'standard', overrides: {} };
  }
  // A missing config file is allowed: default to standard.
  if (!fs.existsSync(configPath)) {
    return { version: 1, profile: 'standard', overrides: {} };
  }
  // A present config file MUST be valid. Any malformed/invalid content fails closed.
  const content = fs.readFileSync(configPath, 'utf-8');
  let config;
  try {
    config = JSON.parse(content);
  } catch {
    config = parseSimpleYAML(content);
  }
  return validateOrThrow(config, configPath);
}

// Validate a parsed config object, throwing on any error (fail closed).
function validateOrThrow(config, source = 'config') {
  const validation = validateConfig(config);
  if (!validation.valid) {
    const where = typeof source === 'string' ? ` in ${source}` : '';
    throw new Error(
      `Invalid plane-workflow configuration${where}:\n` + validation.errors.join('\n')
    );
  }
  return config;
}

// Top-level keys allowed in a config file. Anything else is rejected so an
// unrecognized line cannot silently become an empty object (fail closed).
const ALLOWED_TOP_KEYS = new Set(['version', 'profile', 'overrides', 'execution_context']);

// Top-level keys that may open a nested block in the simple YAML parser.
const NESTED_CONFIG_KEYS = new Set(['overrides', 'execution_context']);

/**
 * Minimal YAML parser for plane-workflow config format.
 * Supports one level of nesting (e.g. the `overrides:` block) and inline values.
 * Strict: any line that does not conform throws, so malformed input fails closed
 * instead of being skipped.
 */
export function parseSimpleYAML(content) {
  const root = {};
  let current = root;
  const indentOf = (line) => line.length - line.replace(/^\s*/, '').length;

  const lines = content.split('\n');
  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const indent = indentOf(line);
    const colon = trimmed.indexOf(':');
    if (colon === -1) {
      throw new Error(`Invalid YAML: expected "key: value" but found line "${trimmed}"`);
    }

    const key = trimmed.slice(0, colon).trim();
    let value = trimmed.slice(colon + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');

    if (indent === 0) {
      if (!ALLOWED_TOP_KEYS.has(key)) {
        throw new Error(`Invalid YAML: unknown top-level key "${key}"`);
      }
      if (value === '') {
        if (!NESTED_CONFIG_KEYS.has(key)) {
          throw new Error(`Invalid YAML: key "${key}" requires a value`);
        }
        // Open a nested object (e.g. `overrides:`)
        root[key] = {};
        current = root[key];
      } else {
        root[key] = value;
        current = root;
      }
    } else {
      if (current === root) {
        throw new Error(`Invalid YAML: unexpected indentation for key "${key}"`);
      }
      current[key] = value;
    }
  }
  return root;
}

/**
 * Merge profile defaults with overrides, applying priority rules.
 * Throws on any invalid profile, unknown override key, or invalid value (fail closed).
 * @param {string} profile - Profile name (minimal, standard, strict)
 * @param {object} overrides - Strategy item overrides
 * @returns {object} Merged configuration
 */
export function mergeConfig(profile = 'standard', overrides = {}) {
  if (!PROFILE_DEFAULTS[profile]) {
    throw new Error(`Invalid profile: '${profile}'. Valid profiles: ${Object.keys(PROFILE_DEFAULTS).join(', ')}`);
  }

  // Start with profile defaults
  const merged = { ...PROFILE_DEFAULTS[profile] };
  merged.profile = profile;

  // Check for Invariant overrides (never allowed)
  for (const invariant of Object.keys(PROTECTED_INVARIANTS)) {
    if (invariant in overrides) {
      throw new Error(`Cannot override Invariant '${invariant}'`);
    }
  }

  // Apply overrides
  for (const [key, value] of Object.entries(overrides)) {
    if (!STRATEGY_SCHEMA[key]) {
      throw new Error(`Unknown strategy item '${key}'. Valid items: ${Object.keys(STRATEGY_SCHEMA).join(', ')}`);
    }
    if (!STRATEGY_SCHEMA[key].includes(value)) {
      throw new Error(`Invalid value '${value}' for '${key}'. Valid values: ${STRATEGY_SCHEMA[key].join(', ')}`);
    }
    merged[key] = value;
  }

  // Forbidden combinations must also fail closed
  const comboErrors = checkForbiddenCombinations(profile, merged);
  if (comboErrors.length) {
    throw new Error(comboErrors.join('; '));
  }

  return merged;
}

/**
 * Check a fully-merged configuration for forbidden profile/strategy combinations.
 * @returns {string[]} List of violation messages (empty if allowed)
 */
export function checkForbiddenCombinations(profile, merged) {
  const errors = [];
  const is = (key, value) => merged[key] === value;

  if (profile === 'minimal') {
    if (is('completion_gate', 'production_deployment')) {
      errors.push("Forbidden: minimal profile cannot use completion_gate 'production_deployment'. Use standard or strict.");
    }
    if (is('audit_comments', 'detailed')) {
      errors.push("Forbidden: minimal profile cannot use audit_comments 'detailed'. Use standard or strict.");
    }
    if (is('release_reconciliation', 'enabled')) {
      errors.push("Forbidden: minimal profile cannot use release_reconciliation 'enabled'. Use strict.");
    }
  }

  // completion_gate: merge violates Reality Check (Invariant 5)
  if (is('completion_gate', 'merge')) {
    errors.push("Forbidden: completion_gate 'merge' violates Reality Check (Invariant 5). Use 'release_confirmed' or 'production_deployment'.");
  }

  // production deployment requires explicit/risk_based planning, never implicit
  if (is('completion_gate', 'production_deployment') && is('plan_confirmation', 'implicit')) {
    errors.push("Forbidden: production_deployment requires explicit/risk_based planning; 'implicit' plan_confirmation is too risky.");
  }

  // pr_ready + production_deployment + no audit has insufficient traceability
  if (is('review_gate', 'pr_ready') && is('completion_gate', 'production_deployment') && is('audit_comments', 'none')) {
    errors.push("Forbidden: pr_ready + production_deployment + audit 'none' has insufficient traceability. Use 'summary' or 'detailed'.");
  }

  return errors;
}

// Top-level keys allowed in a config object. Anything else is rejected.
const ALLOWED_CONFIG_KEYS = new Set(['version', 'profile', 'overrides', 'execution_context']);

/**
 * Validate configuration against schema and invariants.
 * Pure: returns { valid, errors } and never throws.
 * Enforces that a present config declares a supported `version` and a `profile`,
 * and that `overrides` (when present) is an object — so an incomplete or malformed
 * config fails closed instead of silently defaulting.
 * @param {object} config - Configuration to validate
 * @returns {object} Validation result { valid: boolean, errors: string[] }
 */
export function validateConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { valid: false, errors: ['Configuration must be an object'] };
  }

  // version must be present and supported (currently 1).
  if (config.version === undefined) {
    errors.push('Missing required field "version" (must be 1)');
  } else if (String(config.version) !== '1') {
    errors.push(`Unsupported version "${config.version}" (supported: 1)`);
  }

  // profile is required for a present config file (a missing file is handled
  // separately by parseConfig, which defaults to standard).
  if (config.profile === undefined) {
    errors.push('Missing required field "profile"');
  }

  if (config.profile !== undefined && !PROFILE_DEFAULTS[config.profile]) {
    errors.push(`Invalid profile: '${config.profile}'. Valid profiles: ${Object.keys(PROFILE_DEFAULTS).join(', ')}`);
  }

  // overrides, when present, must be an object (not a scalar/array).
  if (config.overrides !== undefined) {
    if (typeof config.overrides !== 'object' || Array.isArray(config.overrides) || config.overrides === null) {
      errors.push('Field "overrides" must be an object');
    }
  }

  // execution_context, when present, must be a valid Layer 2 config object.
  if (config.execution_context !== undefined) {
    const ec = config.execution_context;
    if (typeof ec !== 'object' || Array.isArray(ec) || ec === null) {
      errors.push('Field "execution_context" must be an object');
    } else {
      if (ec.mode === undefined) {
        errors.push('Field "execution_context.mode" is required');
      } else if (!EXECUTION_CONTEXT_SCHEMA.mode.includes(ec.mode)) {
        errors.push(`Invalid execution_context.mode '${ec.mode}'. Valid: ${EXECUTION_CONTEXT_SCHEMA.mode.join(', ')}`);
      }
      if (ec.format !== undefined && !EXECUTION_CONTEXT_SCHEMA.format.includes(ec.format)) {
        errors.push(`Invalid execution_context.format '${ec.format}'. Valid: ${EXECUTION_CONTEXT_SCHEMA.format.join(', ')}`);
      }
      if (ec.root !== undefined && typeof ec.root !== 'string') {
        errors.push('Field "execution_context.root" must be a string');
      }
      for (const key of Object.keys(ec)) {
        if (!['mode', 'root', 'format'].includes(key)) {
          errors.push(`Unknown execution_context field '${key}'`);
        }
      }
    }
  }

  // Reject unknown top-level keys.
  for (const key of Object.keys(config)) {
    if (!ALLOWED_CONFIG_KEYS.has(key)) {
      errors.push(`Unknown top-level field "${key}"`);
    }
  }

  const profile = config.profile || 'standard';
  const overrides = (config.overrides && typeof config.overrides === 'object' && !Array.isArray(config.overrides)) ? config.overrides : {};

  for (const [key, value] of Object.entries(overrides)) {
    if (!STRATEGY_SCHEMA[key]) {
      errors.push(`Unknown strategy item: '${key}'. Valid items: ${Object.keys(STRATEGY_SCHEMA).join(', ')}`);
      continue;
    }
    if (!STRATEGY_SCHEMA[key].includes(value)) {
      errors.push(`Invalid value '${value}' for '${key}'. Valid values: ${STRATEGY_SCHEMA[key].join(', ')}`);
    }
  }

  // Forbidden combination checks (computed on the effective merged config)
  const merged = { ...PROFILE_DEFAULTS[profile], ...overrides };
  errors.push(...checkForbiddenCombinations(profile, merged));

  // project_boundary invariant: cannot be set to anything other than 'fixed'
  if (merged.project_boundary && merged.project_boundary !== 'fixed') {
    errors.push('Invariant violation: project_boundary must always be "fixed"');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Resolve the optional Execution Context (Layer 2) configuration.
 *
 * This is INDEPENDENT of the six Profile strategy items and is never touched
 * by mergeConfig(). It normalizes a raw `execution_context` block into a complete
 * object with defaults filled in, failing closed on invalid input.
 *
 * Normalization table:
 *   - absent execution_context        => { mode: 'disabled' }
 *   - { mode: 'auto' }                => fills root (default .agent-work) + format (default execution_context_v1)
 *   - mode: 'required' + non-string root => fail closed
 *   - unknown nested field            => fail closed
 *
 * @param {object} rawConfig - The parsed config object (may omit execution_context)
 * @returns {object} Resolved execution context { mode, root, format }
 */
export function resolveExecutionContext(rawConfig = {}) {
  const raw = rawConfig && rawConfig.execution_context;
  if (raw === undefined || raw === null) {
    return { mode: 'disabled' };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid execution_context: must be an object');
  }
  if (raw.mode === undefined) {
    throw new Error('Invalid execution_context: "mode" is required');
  }
  if (!EXECUTION_CONTEXT_SCHEMA.mode.includes(raw.mode)) {
    throw new Error(`Invalid execution_context.mode '${raw.mode}'. Valid: ${EXECUTION_CONTEXT_SCHEMA.mode.join(', ')}`);
  }
  for (const key of Object.keys(raw)) {
    if (!['mode', 'root', 'format'].includes(key)) {
      throw new Error(`Unknown execution_context field '${key}'`);
    }
  }
  if (raw.root !== undefined && typeof raw.root !== 'string') {
    throw new Error('Invalid execution_context.root: must be a string');
  }
  return {
    mode: raw.mode,
    root: raw.root ?? EXECUTION_CONTEXT_SCHEMA.DEFAULT_ROOT,
    format: raw.format ?? EXECUTION_CONTEXT_SCHEMA.DEFAULT_FORMAT,
  };
}

/**
 * Generate diagnostic output showing effective configuration.
 * @param {string} profile - Profile name
 * @param {object} overrides - Strategy overrides
 * @returns {string} Diagnostic output
 */
export function diagnose(profile = 'standard', overrides = {}, executionContext) {
  // Build a complete, shape-valid config (version is always 1 here) so the
  // internal validation passes even though callers pass profile + overrides.
  const validation = validateConfig({ version: 1, profile, overrides });

  if (!validation.valid) {
    return `Configuration errors:\n${validation.errors.map(e => `  - ${e}`).join('\n')}`;
  }

  const merged = mergeConfig(profile, overrides);

  let output = `Profile: ${profile}\n`;
  output += `\nEffective configuration:\n`;

  for (const [key, value] of Object.entries(merged)) {
    const isOverridden = key !== 'profile' && overrides[key] !== undefined;
    const marker = isOverridden ? ' (override)' : '';
    output += `  ${key}: ${value}${marker}\n`;
  }

  // Execution Context (Layer 2) — local config only. The CLI has no Plane
  // workItem or Workflow Binding provider, so it must NOT display a "resolved
  // Workflow Binding". Only the locally configured execution_context is shown.
  const ec = resolveExecutionContext({ execution_context: executionContext });
  output += `\nExecution Context (Layer 2, local only):\n`;
  output += `  mode: ${ec.mode}\n`;
  output += `  root: ${ec.root}\n`;
  output += `  format: ${ec.format}\n`;

  output += `\nInvariants (always enforced):\n`;
  output += `  - Read-only requests must not write\n`;
  output += `  - Write-back verification required\n`;
  output += `  - Authorization required for all writes\n`;
  output += `  - Project boundary is fixed (cannot cross)\n`;
  output += `  - Reality check required for completion\n`;

  return output;
}

/**
 * Get the completion gate for a given profile and overrides.
 */
export function getCompletionGate(profile = 'standard', overrides = {}) {
  const config = mergeConfig(profile, overrides);
  return config.completion_gate;
}

/**
 * Export the effective configuration as a complete JSON Schema (draft-07).
 *
 * This is the single source of truth for the configuration shape. The markdown
 * block in `plane-workflow/references/configuration-schema.md` is generated
 * from this function by `scripts/generate-schema.mjs` and verified byte-for-byte
 * by `scripts/validate.mjs`, so the two can never drift into a third copy.
 *
 * The `allOf` forbidden-combination constraints mirror `checkForbiddenCombinations`
 * (the runtime enforcement) so external tools that consume this schema reject the
 * same combinations the parser rejects.
 */
export function getSchema() {
  const overrides = {
    type: 'object',
    description: 'Override specific strategy items',
    additionalProperties: false,
    properties: Object.fromEntries(
      Object.entries(STRATEGY_SCHEMA).map(([key, values]) => [
        key,
        { type: 'string', enum: values },
      ])
    ),
  };
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'Plane Workflow Configuration',
    type: 'object',
    additionalProperties: false,
    required: ['version', 'profile'],
    properties: {
      version: {
        type: 'integer',
        const: 1,
        description: 'Configuration schema version',
      },
      profile: {
        type: 'string',
        enum: Object.keys(PROFILE_DEFAULTS),
        default: 'standard',
        description: 'Preset profile name',
      },
      overrides,
      execution_context: {
        type: 'object',
        description: 'Optional local execution memory (Layer 2) configuration. Independent of the six Profile strategy items.',
        additionalProperties: false,
        required: ['mode'],
        properties: {
          mode: {
            type: 'string',
            enum: ['disabled', 'auto', 'required'],
            default: 'disabled',
            description: 'disabled = no Layer 2 files; auto = decide per workItem; required = always create context',
          },
          root: {
            type: 'string',
            description: 'Directory for execution context files (default .agent-work)',
          },
          format: {
            type: 'string',
            const: 'execution_context_v1',
            description: 'Execution Context file format version',
          },
        },
      },
    },
    allOf: [
      {
        if: { properties: { profile: { const: 'minimal' } }, required: ['profile'] },
        then: {
          not: {
            required: ['overrides'],
            properties: {
              overrides: {
                required: ['completion_gate'],
                properties: { completion_gate: { enum: ['production_deployment'] } },
              },
            },
          },
        },
        description: 'minimal profile cannot override completion_gate to production_deployment',
      },
      {
        if: { properties: { profile: { const: 'minimal' } }, required: ['profile'] },
        then: {
          not: {
            required: ['overrides'],
            properties: {
              overrides: {
                required: ['audit_comments'],
                properties: { audit_comments: { enum: ['detailed'] } },
              },
            },
          },
        },
        description: 'minimal profile cannot override audit_comments to detailed',
      },
      {
        if: { properties: { profile: { const: 'minimal' } }, required: ['profile'] },
        then: {
          not: {
            required: ['overrides'],
            properties: {
              overrides: {
                required: ['release_reconciliation'],
                properties: { release_reconciliation: { enum: ['enabled'] } },
              },
            },
          },
        },
        description: 'minimal profile cannot override release_reconciliation to enabled',
      },
      {
        not: {
          required: ['overrides'],
          properties: {
            overrides: {
              required: ['completion_gate'],
              properties: { completion_gate: { enum: ['merge'] } },
            },
          },
        },
        description: "completion_gate 'merge' violates Reality Check (Invariant 5)",
      },
      {
        if: {
          required: ['overrides'],
          properties: {
            overrides: {
              required: ['completion_gate', 'plan_confirmation'],
              properties: {
                completion_gate: { const: 'production_deployment' },
                plan_confirmation: { const: 'implicit' },
              },
            },
          },
        },
        then: false,
        description: 'production_deployment requires explicit/risk_based planning, never implicit',
      },
      {
        if: {
          required: ['overrides'],
          properties: {
            overrides: {
              required: ['review_gate', 'completion_gate', 'audit_comments'],
              properties: {
                review_gate: { const: 'pr_ready' },
                completion_gate: { const: 'production_deployment' },
                audit_comments: { const: 'none' },
              },
            },
          },
        },
        then: false,
        description: 'pr_ready + production_deployment requires audit summary/detailed',
      },
    ],
  };
}
