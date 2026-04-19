# Rules Evaluator Contract

## Purpose

Define the minimum evaluator behavior required to turn:

- `decision_rules.json`
- `rules.schema.json`
- structured user input

into:

- blocker validation results
- a normalized architecture recommendation
- Terraform generation readiness

This contract is intended to be the runtime execution layer that sits between the questionnaire UI and Terraform generation.

## Core Evaluator Responsibility

The evaluator must:

1. load the machine-readable rules artifact
2. validate it against the schema
3. validate required blocker fields against user input
4. evaluate rule conditions
5. merge rule outputs into a normalized recommendation object
6. surface unresolved questions and assumptions
7. determine whether Terraform generation is allowed

## Inputs

### 1. Rules Artifact

- `decision_rules.json`

### 2. Rules Schema

- `rules.schema.json`

### 3. User Input Object

The evaluator should accept a structured input object aligned to the input contract defined in `decision_rules.json`.

Example:

```json
{
  "workload": {
    "app_type": "public_api",
    "packaging": "function",
    "runtime": "node",
    "statefulness": "stateless",
    "request_pattern": "synchronous",
    "max_execution_time": "short_under_15m",
    "environments": ["dev", "prod"],
    "single_tenant_or_multi_tenant": "single"
  },
  "traffic": {
    "internet_exposed": "yes",
    "global_users": "yes",
    "estimated_rps": 200,
    "traffic_variability": "spiky",
    "websocket_or_streaming": "no",
    "latency_sensitivity": "medium"
  },
  "data": {
    "primary_data_model": "relational",
    "relational_features_needed": "transactions",
    "read_write_profile": "balanced",
    "data_retention": "long",
    "backups_required": "yes",
    "disaster_recovery_tier": "in_region_ha"
  },
  "security_and_compliance": {
    "data_sensitivity": "confidential",
    "compliance": "soc2_like",
    "encryption_customer_managed": "yes",
    "public_access_exceptions": "public_api",
    "secret_types": "db_credentials",
    "human_access_model": "federated_only"
  },
  "networking": {
    "needs_vpc_private_resources": "yes",
    "outbound_internet_needed_from_private": "yes",
    "private_connectivity_only": "no",
    "on_prem_or_other_vpc_connectivity": "no"
  },
  "operations": {
    "team_ops_maturity": "low",
    "logs_and_metrics_required": "enhanced",
    "change_frequency": "high"
  },
  "cost": {
    "monthly_budget_band": "moderate",
    "cost_priority": "balanced",
    "commitment_ok": "savings_plans_ok"
  },
  "features": {
    "needs_api_keys": false,
    "needs_per_client_throttling": false,
    "needs_request_validation": false,
    "needs_waf_on_api_gateway": false,
    "needs_private_api": false
  }
}
```

## Output Contract

The evaluator should return an object shaped like:

```json
{
  "validRules": true,
  "schemaErrors": [],
  "missingBlockers": [],
  "matchedRuleIds": [],
  "architecture": {
    "compute_plane": null,
    "ingress_plane": null,
    "data_plane": null,
    "network_plane": null,
    "security_baseline": [],
    "observability_baseline": [],
    "cost_control_baseline": []
  },
  "recommendation": {
    "architecture_summary": {},
    "required_resources": [],
    "optional_resources": [],
    "security_controls": [],
    "cost_controls": [],
    "risks": [],
    "assumptions": [],
    "terraform_modules": [],
    "unresolved_questions": []
  },
  "terraformReady": false
}
```

## Evaluator API

The minimum evaluator contract should expose functions equivalent to:

```text
loadRules(rulesPath, schemaPath) -> { rules, schemaValidationResult }

validateRules(rules, schema) -> {
  valid: boolean,
  errors: string[]
}

validateBlockers(input, requiredBlockers) -> {
  missing: string[]
}

evaluateRules(input, rules) -> {
  matchedRuleIds: string[],
  architecture: object,
  recommendation: object
}

finalizeRecommendation(evaluationResult) -> {
  terraformReady: boolean,
  output: object
}
```

## Condition Evaluation Semantics

The evaluator must support these condition types:

- `equals`
- `in`
- `contains`

Supported rule sections:

- `when_all`
- `when_any`
- `unless_any`

Evaluation semantics:

- `when_all`: all conditions must pass
- `when_any`: at least one condition must pass
- `unless_any`: none of the listed conditions may pass

If a rule has:

- only `when_all`, then all listed conditions must match
- only `when_any`, then at least one listed condition must match
- both, then both sections must be satisfied together
- `unless_any`, the rule must be rejected if any `unless_any` condition matches

## Merge Semantics

When rules match, the evaluator should merge results in a deterministic way.

### Scalar Planes

These fields should be treated as scalar decisions:

- `compute_plane`
- `ingress_plane`
- `data_plane`
- `network_plane`

Recommended merge rule:

- sort matching rules by `priority` descending
- first matching rule that sets a scalar field wins unless an override mechanism is introduced later

### Array-Based Outputs

These fields should merge as de-duplicated arrays:

- `required_resources`
- `optional_resources`
- `security_controls`
- `cost_controls`
- `assumptions`
- `terraform_modules`

### Risks and Unresolved Questions

The evaluator should append:

- rule-generated assumptions
- explicit unresolved questions
- unmet explicit assumptions

Terraform must not be considered ready if unresolved questions remain.

## Terraform Readiness

`terraformReady` should be `true` only when:

- rules file is schema-valid
- blocker fields are present
- unresolved questions is empty
- the architecture has enough selected planes to support generation

At minimum, the evaluator should require:

- compute plane or static-site-only path
- ingress plane where public or internal access requires it
- data plane when the workload needs persistent data
- network plane when private networking is required

## Suggested Internal Execution Order

1. validate rules against schema
2. validate blockers against user input
3. collect applicable rules by category
4. sort applicable rules by priority
5. merge scalar plane decisions
6. merge additive resource/control arrays
7. derive unresolved questions
8. compute Terraform readiness

## Non-Goals for the Initial Evaluator

The first evaluator does not need to:

- estimate live AWS pricing
- generate Terraform text
- render UI
- support arbitrary user-authored rule syntax
- perform cross-rule conflict resolution beyond priority ordering

## Engineering Expectation

The implementation should keep the evaluator small, testable, deterministic, and independent from the UI layer.

The UI should call the evaluator and render its outputs, rather than embedding recommendation logic directly in components.
