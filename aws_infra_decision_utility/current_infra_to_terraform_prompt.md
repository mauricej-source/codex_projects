# AWS Infrastructure Decision Utility for Terraform Generation

## Product Intent

Build a web application that helps an end user decide what AWS infrastructure should be provisioned before Terraform is generated.

This product should behave as a constrained AWS architecture advisor with a Terraform backend, not as a free-form Terraform code generator. The highest-value function is converting business and technical intent into:

- an explicit architecture choice
- a security and risk posture
- a cost-aware deployment recommendation
- a stable Terraform-ready architecture specification

Terraform generation happens only after the recommendation is fully specified and unresolved questions are cleared.

## Core Product Principle

Use a `spec first, Terraform second` architecture.

The application must:

1. collect structured user intent
2. evaluate that intent against AWS decision rules
3. derive an intermediate architecture specification
4. validate security, cost, and operational guardrails
5. explain the recommendation in plain English
6. generate Terraform only when the architecture is sufficiently resolved

Do not generate Terraform directly from raw form inputs.

## Target User

Design for a user who understands application intent but may not yet know the correct AWS architecture or Terraform structure. Typical users may include:

- solo engineers
- startup technical founders
- platform engineers
- cloud engineers
- solutions architects

## Primary User Outcome

A user should be able to:

1. answer guided infrastructure questions
2. receive a recommended AWS architecture
3. understand why the recommendation was chosen
4. review risks, assumptions, and cost/security implications
5. generate Terraform from the recommendation

## Technology Direction

Build a modern web application with:

- a clean, professional UI
- modular architecture
- strong separation between questionnaire, rules engine, recommendation model, explanation layer, and Terraform generation
- support for representing the decision rules in structured JSON, YAML, or TypeScript configuration
- direct support for loading the machine-readable rules artifact in [decision_rules.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/decision_rules.json)

## Authoritative Rules Artifact

The machine-readable source of truth for the recommendation engine should be:

- [decision_rules.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/decision_rules.json)
- [rules.schema.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/rules.schema.json)
- [evaluator_contract.md](C:/ws_openai_ws/infrastructure_to_terraform_utility/evaluator_contract.md)

This artifact should drive:

- the input contract
- blocker detection
- service selection logic
- security and cost baselines
- intermediate architecture spec derivation
- Terraform generation gating

The schema file should be used to validate the rules artifact before the application loads it.

The implementation should treat the PDF research as supporting rationale, `decision_rules.json` as the operational rules contract, and `rules.schema.json` as the normalization and validation contract.
The evaluator runtime contract should be defined by [evaluator_contract.md](C:/ws_openai_ws/infrastructure_to_terraform_utility/evaluator_contract.md).

## Rules Normalization Requirement

The application should assume that the rules system is now normalized into:

1. a machine-readable rules artifact
2. a validation schema for that artifact

This means the implementation should:

- validate `decision_rules.json` against `rules.schema.json`
- fail clearly when the rules file does not conform to schema
- keep rule evaluation logic decoupled from UI rendering
- support future rule refinement without requiring a major application redesign
- implement rule execution against the evaluator contract in [evaluator_contract.md](C:/ws_openai_ws/infrastructure_to_terraform_utility/evaluator_contract.md)

## Evaluator Requirement

The application should include a rules evaluator layer that conforms to [evaluator_contract.md](C:/ws_openai_ws/infrastructure_to_terraform_utility/evaluator_contract.md).

That evaluator should be responsible for:

- rule loading
- schema validation
- blocker validation
- condition evaluation
- recommendation merging
- unresolved-question detection
- Terraform readiness determination

UI components should consume evaluator outputs rather than implementing recommendation logic directly.

## MVP Scope

The MVP should be AWS-focused and support a constrained but high-value service set.

### Compute

- AWS Lambda
- Amazon ECS on AWS Fargate
- Amazon EC2

### Ingress and Delivery

- API Gateway HTTP API
- API Gateway REST API
- Application Load Balancer
- CloudFront

### Data

- DynamoDB
- Amazon RDS / Aurora
- Amazon S3

### Async and Workflow

- Amazon SQS
- Amazon EventBridge
- AWS Step Functions

### Security and Ops Baseline

- IAM
- KMS
- Secrets Manager
- CloudTrail
- AWS Config
- GuardDuty
- Security Hub
- AWS WAF where supported and appropriate
- IAM Access Analyzer
- AWS Backup
- Amazon Inspector
- CloudWatch
- AWS Budgets
- Cost Anomaly Detection
- Compute Optimizer

## Required Product Workflow

### 1. Questionnaire Layer

Collect only inputs that materially affect the AWS architecture decision.

The questionnaire should support the structured contract defined in [decision_rules.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/decision_rules.json).

The UI may render the fields from that artifact dynamically or map them into a typed local model, but it should stay aligned to the same contract.

The application should validate the loaded rules file against [rules.schema.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/rules.schema.json) before binding questionnaire fields or executing recommendation logic.

The current contract is:

```yaml
workload:
  app_type: [static_site, public_api, web_app, worker, event_processor, internal_app, batch_job]
  packaging: [source_only, function, container, vm]
  runtime: [node, python, java, go, dotnet, other]
  statefulness: [stateless, session_state, shared_files, stateful_service]
  request_pattern: [synchronous, asynchronous, mixed]
  max_execution_time: [short_under_15m, long_running]
  environments: [dev, staging, prod]
  single_tenant_or_multi_tenant: [single, multi]

traffic:
  internet_exposed: [yes, no]
  global_users: [yes, no]
  estimated_rps: integer
  traffic_variability: [steady, diurnal, spiky, unpredictable]
  websocket_or_streaming: [yes, no]
  latency_sensitivity: [low, medium, high]

data:
  primary_data_model: [none, key_value, document, relational, object, file, cache]
  relational_features_needed: [joins, transactions, reporting, none]
  read_write_profile: [read_heavy, write_heavy, balanced]
  data_retention: [short, medium, long]
  backups_required: [yes, no]
  disaster_recovery_tier: [none, in_region_ha, cross_region]

security_and_compliance:
  data_sensitivity: [public, internal, confidential, regulated]
  compliance: [none, soc2_like, hipaa_like, pci_like, custom]
  encryption_customer_managed: [yes, no]
  public_access_exceptions: [none, approved_public_s3, public_api, public_alb]
  secret_types: [none, app_secrets, db_credentials, api_keys]
  human_access_model: [console_ok, federated_only, break_glass_only]

networking:
  needs_vpc_private_resources: [yes, no]
  outbound_internet_needed_from_private: [yes, no]
  private_connectivity_only: [yes, no]
  on_prem_or_other_vpc_connectivity: [yes, no]

operations:
  team_ops_maturity: [low, medium, high]
  logs_and_metrics_required: [baseline, enhanced, audit_grade]
  change_frequency: [low, medium, high]

cost:
  monthly_budget_band: [minimal, constrained, moderate, flexible]
  cost_priority: [lowest_possible, balanced, performance_first]
  commitment_ok: [none, savings_plans_ok, spot_ok]
```

### 2. Required Blockers Before Recommendation

The application should not proceed to final recommendation or Terraform generation unless the blocker fields declared in [decision_rules.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/decision_rules.json) are present.

The current blocker set is:

- internet exposure
- environments
- data sensitivity
- primary data model
- backups required
- budget band

### 3. Intermediate Architecture Specification

Before Terraform generation, derive a normalized architecture specification with at least:

- compute plane
- ingress plane
- data plane
- network plane
- security baseline
- observability baseline
- cost-control baseline

This derivation should happen through the evaluator contract, not through ad hoc UI logic.

### 4. Recommendation Output Contract

The system should produce a stable object shaped like the recommendation output contract defined in [decision_rules.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/decision_rules.json).

The current target shape is:

```json
{
  "architecture_summary": {},
  "required_resources": [],
  "optional_resources": [],
  "security_controls": [],
  "cost_controls": [],
  "risks": [],
  "assumptions": [],
  "terraform_modules": [],
  "unresolved_questions": []
}
```

If `unresolved_questions` is not empty, stop before Terraform generation.

## Decision Rules to Implement

Implement [decision_rules.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/decision_rules.json) as the product’s source-of-truth decision logic.

The PDF report should be treated as rationale and documentation. The rules artifact should be treated as the implementation contract, and [rules.schema.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/rules.schema.json) should be treated as the validation contract.
The execution model for those rules should conform to [evaluator_contract.md](C:/ws_openai_ws/infrastructure_to_terraform_utility/evaluator_contract.md).

### Compute Rules

- Default to Lambda when the workload is event-driven or request-driven, short-lived, mostly stateless, bursty or unpredictable, and operational simplicity is preferred.
- Default to ECS on Fargate when the workload is containerized, long-running, needs explicit CPU/memory sizing, or is awkward in Lambda.
- Choose EC2 only when the workload requires OS-level control, custom agents/drivers, unusual networking, licensing constraints, or specialized instance families.

### Data Rules

- Default to DynamoDB when the primary data model is key-value or document and relational joins are not required.
- Default to RDS or Aurora when the workload needs SQL, joins, transactions, or conventional relational semantics.
- Always include S3 when the workload needs object storage, static assets, uploads, or backup artifacts.
- Add EFS only when explicit shared POSIX-style file system behavior is required.
- Add ElastiCache only when the user’s needs explicitly imply hot-read caching, session caching, or latency offload.

### Ingress Rules

- For public APIs, default to API Gateway HTTP API unless the user requires REST-only features like API keys, per-client throttling, request validation, WAF integration at API Gateway, or private API endpoints.
- For conventional HTTP web applications and container/VM services, default to ALB.
- Add CloudFront when users are globally distributed, caching is important, or S3 is used as an origin.

### Network Rules

- Only edge-facing components should be in public subnets.
- Application compute, databases, caches, and VPC-attached Lambda should normally live in private subnets.
- Add NAT gateway when private resources need outbound internet access.
- Prefer gateway endpoints for S3 and DynamoDB instead of NAT where applicable.
- For Lambda attached to a VPC, enforce private subnets.
- For production, default to multi-AZ patterns where appropriate.

### Security and Compliance Rules

- Always attach a non-optional security baseline.
- Enforce least-privilege IAM.
- Use Secrets Manager for application/database/API secrets.
- For confidential or regulated workloads, enforce stronger controls including encryption, backups, deletion protection, centralized security services, and stronger governance guidance.
- Add WAF for public workloads where the selected ingress supports it and the risk/compliance posture warrants it.
- Keep S3 Block Public Access on by default unless the user explicitly approves a public exception.

### Cost and Operations Rules

- Add AWS Budgets and Cost Anomaly Detection as baseline cost controls.
- Add Compute Optimizer / right-sizing hooks where relevant.
- Bias recommendations toward managed services when team ops maturity is low.

## Terraform Generation Rules

Generate Terraform only after the architecture specification is stable.

Terraform generation behavior should remain aligned to the `terraform_generation` section in [decision_rules.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/decision_rules.json).
Terraform generation readiness should be determined through the evaluator contract described in [evaluator_contract.md](C:/ws_openai_ws/infrastructure_to_terraform_utility/evaluator_contract.md).

### Terraform Expectations

- Use an S3 backend for remote state by default
- Support locking with `use_lockfile = true`
- Pin Terraform and provider versions
- Keep provider configuration in the root module
- Keep child modules focused on architectural concepts, not thin single-resource wrappers
- Prefer flat module composition from the root

### Example Module Boundaries

Good module examples:

- `network`
- `api_ingress`
- `ecs_service`
- `lambda_api`
- `rds_postgres`
- `dynamodb_table`
- `static_site`
- `security_baseline`

Avoid generating trivial one-resource modules unless they encode a broader reusable contract.

## UI Requirements

The application should include:

- a guided questionnaire or wizard
- a recommendation summary view
- an explanation panel for why each major AWS choice was made
- a risk and assumptions section
- a cost and security guardrail section
- a Terraform output panel
- a review step before generation

## Product Design Principles

- recommendation-first, not code-first
- explainable AWS choices
- security and cost guardrails by default
- Terraform as the final artifact, not the only artifact
- constrained AWS-focused MVP rather than “support everything”

## Deliverables

Deliver a maintainable application that includes:

- a functioning questionnaire
- structured answer storage
- a rules-driven AWS recommendation engine
- an evaluator implementation aligned to [evaluator_contract.md](C:/ws_openai_ws/infrastructure_to_terraform_utility/evaluator_contract.md)
- an intermediate architecture spec
- human-readable recommendation explanations
- risk, assumption, and unresolved-question handling
- Terraform output based on the resolved architecture

## Important Implementation Constraint

Do not invent ad hoc infrastructure logic when [decision_rules.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/decision_rules.json) already defines the intended decision boundaries. The system should be built so the JSON artifact can evolve independently over time without forcing major UI rewrites.

Also ensure the implementation remains compatible with [rules.schema.json](C:/ws_openai_ws/infrastructure_to_terraform_utility/rules.schema.json) so the rules layer stays testable, loadable, and maintainable over time.
