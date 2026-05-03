import rules from "../../decision_rules.json";
import schema from "../../rules.schema.json";
import { evaluateInfrastructure } from "./evaluator";
import { generateTerraformProject } from "./terraform";
import type { RulesArtifact, UserInput } from "./types";

const sampleInput: UserInput = {
  workload: {
    app_type: "public_api",
    packaging: "function",
    runtime: "node",
    statefulness: "stateless",
    request_pattern: "synchronous",
    max_execution_time: "short_under_15m",
    environments: ["dev", "prod"],
    single_tenant_or_multi_tenant: "single",
    orchestration_preference: "none",
  },
  traffic: {
    internet_exposed: "yes",
    global_users: "yes",
    estimated_rps: 200,
    traffic_variability: "spiky",
    websocket_or_streaming: "no",
    latency_sensitivity: "medium",
  },
  data: {
    primary_data_model: "relational",
    relational_features_needed: "transactions",
    read_write_profile: "balanced",
    data_retention: "long",
    backups_required: "yes",
    disaster_recovery_tier: "in_region_ha",
  },
  security_and_compliance: {
    data_sensitivity: "confidential",
    compliance: "soc2_like",
    encryption_customer_managed: "yes",
    public_access_exceptions: "public_api",
    secret_types: "db_credentials",
    human_access_model: "federated_only",
  },
  networking: {
    needs_vpc_private_resources: "yes",
    outbound_internet_needed_from_private: "yes",
    private_connectivity_only: "no",
    on_prem_or_other_vpc_connectivity: "no",
    custom_cni_needed: "no",
  },
  operations: {
    team_ops_maturity: "low",
    logs_and_metrics_required: "enhanced",
    change_frequency: "high",
  },
  cost: {
    monthly_budget_band: "moderate",
    cost_priority: "balanced",
    commitment_ok: "savings_plans_ok",
  },
};

const evaluation = evaluateInfrastructure(sampleInput, rules as RulesArtifact, schema);

if (!evaluation.validRules) {
  throw new Error(`Expected rules to validate, got ${evaluation.schemaErrors.join("; ")}`);
}

if (evaluation.architecture.compute_plane !== "lambda") {
  throw new Error(`Expected lambda compute plane, got ${evaluation.architecture.compute_plane}`);
}

if (!evaluation.terraformReady) {
  throw new Error(`Expected Terraform readiness, got ${evaluation.recommendation.unresolved_questions.join("; ")}`);
}

if (!evaluation.recommendation.terraform_modules.includes("rds_postgres")) {
  throw new Error(`Expected rds_postgres module for relational data, got ${evaluation.recommendation.terraform_modules.join(", ")}`);
}

const projectFiles = generateTerraformProject(sampleInput, evaluation, rules as RulesArtifact);
const paths = projectFiles.map((file) => file.path);

for (const expectedPath of ["README.md", "backend.hcl", "terraform.tfvars.example", "main.tf", "modules/network/main.tf", "modules/rds_postgres/main.tf", "modules/security_baseline/main.tf"]) {
  if (!paths.includes(expectedPath)) {
    throw new Error(`Expected generated Terraform file ${expectedPath}, got ${paths.join(", ")}`);
  }
}

const projectText = projectFiles.map((file) => file.content).join("\n");
if (projectText.includes("replace-with")) {
  throw new Error("Expected generated Terraform project to centralize placeholder values without replace-with literals.");
}

const rdsModule = projectFiles.find((file) => file.path === "modules/rds_postgres/main.tf")?.content ?? "";
if (!rdsModule.includes("aws_db_instance") || !rdsModule.includes("aws_db_proxy")) {
  throw new Error("Expected RDS module to include DB instance and RDS proxy resources.");
}

console.log("Evaluator contract smoke test passed.");
