#!/usr/bin/env node

// scripts/diagnose.mjs
// CLI tool for diagnosing Profile and configuration.
//
// Protocol:
//   plane-workflow config diagnose [config-file]
//   plane-workflow config schema
//   plane-workflow help
// A missing config file falls back to the `standard` profile (allowed), but a
// present file that is invalid fails closed (exit 1).

import { parseConfig, validateConfig, diagnose, getSchema } from './profile-parser.mjs';

const args = process.argv.slice(2);
const command = args[0] || 'help';

switch (command) {
  case 'config':
    handleConfig(args.slice(1));
    break;
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
}

function handleConfig(rest) {
  const sub = rest[0] || 'diagnose';
  const configFile = rest[1]; // optional path
  switch (sub) {
    case 'diagnose':
      runDiagnose(configFile);
      break;
    case 'schema':
      runSchema();
      break;
    default:
      console.error(`Unknown config subcommand: ${sub}`);
      showHelp();
      process.exit(1);
  }
}

function runDiagnose(configFile) {
  const file = configFile || 'plane-workflow.config.yaml';
  let config;
  try {
    config = parseConfig(file);
  } catch (e) {
    console.error('Configuration error:');
    console.error('  ' + e.message);
    process.exit(1);
  }

  const validation = validateConfig(config);
  if (!validation.valid) {
    console.error('Configuration errors:');
    validation.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  console.log(diagnose(config.profile, config.overrides || {}, config.execution_context));
}

function runSchema() {
  console.log(JSON.stringify(getSchema(), null, 2));
}

function showHelp() {
  console.log(`
plane-workflow - Plane workflow profile configuration CLI

Usage:
  plane-workflow config diagnose [config-file]
  plane-workflow config schema
  plane-workflow help

Commands:
  config diagnose [file]   Diagnose effective configuration. Reads [file]
                           (default: plane-workflow.config.yaml). A missing
                           file falls back to the standard profile.
  config schema            Print the JSON Schema for configuration.
  help                     Show this help message.

Examples:
  plane-workflow config diagnose
  plane-workflow config diagnose ./my-config.yaml
  plane-workflow config schema > schema.json
`);
}
