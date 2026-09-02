# Configuration Schema

`plane-workflow.config.yaml` at project root. User guide: [configuration.md](../configuration.md).

```yaml
version: 1
profile: standard
overrides:
  review_gate: user_acceptance
```

## JSON Schema

<!-- SCHEMA:START -->

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Plane Workflow Configuration",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "version",
    "profile"
  ],
  "properties": {
    "version": {
      "type": "integer",
      "const": 1,
      "description": "Configuration schema version"
    },
    "profile": {
      "type": "string",
      "enum": [
        "minimal",
        "standard",
        "strict"
      ],
      "default": "standard",
      "description": "Preset profile name"
    },
    "overrides": {
      "type": "object",
      "description": "Override specific strategy items",
      "additionalProperties": false,
      "properties": {
        "plan_confirmation": {
          "type": "string",
          "enum": [
            "implicit",
            "risk_based",
            "explicit"
          ]
        },
        "review_gate": {
          "type": "string",
          "enum": [
            "pr_ready",
            "user_acceptance"
          ]
        },
        "completion_gate": {
          "type": "string",
          "enum": [
            "release_confirmed",
            "production_deployment",
            "manual"
          ]
        },
        "audit_comments": {
          "type": "string",
          "enum": [
            "none",
            "summary",
            "detailed"
          ]
        },
        "release_reconciliation": {
          "type": "string",
          "enum": [
            "disabled",
            "on_request",
            "enabled"
          ]
        },
        "output_verbosity": {
          "type": "string",
          "enum": [
            "minimal",
            "standard",
            "detailed"
          ]
        }
      }
    },
    "execution_context": {
      "type": "object",
      "description": "Optional local execution memory (Layer 2) configuration. Independent of the six Profile strategy items.",
      "additionalProperties": false,
      "required": [
        "mode"
      ],
      "properties": {
        "mode": {
          "type": "string",
          "enum": [
            "disabled",
            "auto",
            "required"
          ],
          "default": "disabled",
          "description": "disabled = no Layer 2 files; auto = decide per workItem; required = always create context"
        },
        "root": {
          "type": "string",
          "description": "Directory for execution context files (default .agent-work)"
        },
        "format": {
          "type": "string",
          "const": "execution_context_v1",
          "description": "Execution Context file format version"
        }
      }
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "profile": {
            "const": "minimal"
          }
        },
        "required": [
          "profile"
        ]
      },
      "then": {
        "not": {
          "required": [
            "overrides"
          ],
          "properties": {
            "overrides": {
              "required": [
                "completion_gate"
              ],
              "properties": {
                "completion_gate": {
                  "enum": [
                    "production_deployment"
                  ]
                }
              }
            }
          }
        }
      },
      "description": "minimal profile cannot override completion_gate to production_deployment"
    },
    {
      "if": {
        "properties": {
          "profile": {
            "const": "minimal"
          }
        },
        "required": [
          "profile"
        ]
      },
      "then": {
        "not": {
          "required": [
            "overrides"
          ],
          "properties": {
            "overrides": {
              "required": [
                "audit_comments"
              ],
              "properties": {
                "audit_comments": {
                  "enum": [
                    "detailed"
                  ]
                }
              }
            }
          }
        }
      },
      "description": "minimal profile cannot override audit_comments to detailed"
    },
    {
      "if": {
        "properties": {
          "profile": {
            "const": "minimal"
          }
        },
        "required": [
          "profile"
        ]
      },
      "then": {
        "not": {
          "required": [
            "overrides"
          ],
          "properties": {
            "overrides": {
              "required": [
                "release_reconciliation"
              ],
              "properties": {
                "release_reconciliation": {
                  "enum": [
                    "enabled"
                  ]
                }
              }
            }
          }
        }
      },
      "description": "minimal profile cannot override release_reconciliation to enabled"
    },
    {
      "not": {
        "required": [
          "overrides"
        ],
        "properties": {
          "overrides": {
            "required": [
              "completion_gate"
            ],
            "properties": {
              "completion_gate": {
                "enum": [
                  "merge"
                ]
              }
            }
          }
        }
      },
      "description": "completion_gate 'merge' violates Reality Check (Invariant 5)"
    },
    {
      "if": {
        "required": [
          "overrides"
        ],
        "properties": {
          "overrides": {
            "required": [
              "completion_gate",
              "plan_confirmation"
            ],
            "properties": {
              "completion_gate": {
                "const": "production_deployment"
              },
              "plan_confirmation": {
                "const": "implicit"
              }
            }
          }
        }
      },
      "then": false,
      "description": "production_deployment requires explicit/risk_based planning, never implicit"
    },
    {
      "if": {
        "required": [
          "overrides"
        ],
        "properties": {
          "overrides": {
            "required": [
              "review_gate",
              "completion_gate",
              "audit_comments"
            ],
            "properties": {
              "review_gate": {
                "const": "pr_ready"
              },
              "completion_gate": {
                "const": "production_deployment"
              },
              "audit_comments": {
                "const": "none"
              }
            }
          }
        }
      },
      "then": false,
      "description": "pr_ready + production_deployment requires audit summary/detailed"
    }
  ]
}
```

<!-- SCHEMA:END -->
```

## Profile Presets

| Profile | plan_confirmation | review_gate | completion_gate | audit_comments | release_reconciliation | output_verbosity |
|---|---|---|---|---|---|---|---|
| minimal | implicit | pr_ready | release_confirmed | none | disabled | minimal |
| standard | risk_based | pr_ready | release_confirmed | summary | on_request | standard |
| strict | explicit | user_acceptance | production_deployment | detailed | enabled | detailed |

Strategy item meanings: [configuration.md](../configuration.md).

## Priority

1. Five Invariants
2. User explicit instruction
3. Config overrides
4. Profile defaults
5. System default (`standard`)

## Forbidden Combinations

| Condition | Reason |
|---|---|
| `minimal` + `production_deployment` | Use standard/strict |
| `minimal` + `audit_comments: detailed` | Use standard/strict |
| `minimal` + `release_reconciliation: enabled` | Use strict |
| `completion_gate: merge` | Violates Invariant 5 |
| `production_deployment` + `plan_confirmation: implicit` | Too risky |
| `pr_ready` + `production_deployment` + `audit_comments: none` | Need audit trail |

Overrides cannot bypass invariants or create forbidden combinations.

## Validation

**Load:** schema match · forbidden combo check · valid profile · valid override keys

**Runtime:** enforce invariants · apply strategy items

## Errors

```yaml
# Unknown override key → rejected
overrides: { invalid_item: true }

# Forbidden → rejected
profile: minimal
overrides: { completion_gate: production_deployment }
```

## Diagnose

```bash
plane-workflow config diagnose
```

Shows effective profile, strategy items, invariant status, warnings, config path.

