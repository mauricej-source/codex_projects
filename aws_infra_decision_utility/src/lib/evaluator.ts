import Ajv2020 from "ajv/dist/2020";
import type { Architecture, Condition, EvaluationOutput, Primitive, Recommendation, Rule, RulesArtifact, UserInput } from "./types";

const scalarPlanes: Array<keyof Pick<Architecture, "compute_plane" | "ingress_plane" | "data_plane" | "network_plane">> = [
  "compute_plane",
  "ingress_plane",
  "data_plane",
  "network_plane",
];

const arrayFields: Array<keyof Pick<Recommendation, "required_resources" | "optional_resources" | "security_controls" | "cost_controls" | "assumptions">> = [
  "required_resources",
  "optional_resources",
  "security_controls",
  "cost_controls",
  "assumptions",
];

export function validateRules(rules: RulesArtifact, schema: object): { valid: boolean; errors: string[] } {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(rules);
  return {
    valid,
    errors: (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`),
  };
}

export function validateBlockers(input: UserInput, requiredBlockers: string[]): { missing: string[] } {
  const missing = requiredBlockers.filter((path) => {
    const value = getPath(input, path);
    return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  });

  return { missing };
}

export function evaluateInfrastructure(input: UserInput, rules: RulesArtifact, schema: object): EvaluationOutput {
  const schemaValidationResult = validateRules(rules, schema);
  const blockerResult = validateBlockers(input, rules.required_blockers);
  const matchedRules = collectMatchingRules(input, rules);
  const architecture = createEmptyArchitecture();
  const recommendation = createEmptyRecommendation();
  const matchedRuleIds: string[] = [];

  for (const rule of matchedRules) {
    matchedRuleIds.push(rule.id);
    mergeScalarPlanes(architecture, rule);
    mergeRuleOutputs(recommendation, rule);
  }

  architecture.security_baseline = unique(recommendation.security_controls);
  architecture.observability_baseline = deriveObservabilityBaseline(input);
  architecture.cost_control_baseline = unique(recommendation.cost_controls);
  recommendation.architecture_summary = {
    compute: architecture.compute_plane,
    ingress: architecture.ingress_plane,
    data: architecture.data_plane,
    network: architecture.network_plane,
  };
  recommendation.terraform_modules = deriveTerraformModules(architecture, recommendation, rules);

  const unresolvedQuestions = deriveUnresolvedQuestions(input, architecture, blockerResult.missing, rules);
  recommendation.unresolved_questions = unresolvedQuestions;
  recommendation.risks = unique([...recommendation.risks, ...deriveRisks(input, architecture)]);

  const terraformReady =
    schemaValidationResult.valid &&
    blockerResult.missing.length === 0 &&
    unresolvedQuestions.length === 0 &&
    hasSufficientArchitecture(input, architecture);

  return {
    validRules: schemaValidationResult.valid,
    schemaErrors: schemaValidationResult.errors,
    missingBlockers: blockerResult.missing,
    matchedRuleIds,
    architecture,
    recommendation,
    terraformReady,
  };
}

function createEmptyArchitecture(): Architecture {
  return {
    compute_plane: null,
    ingress_plane: null,
    data_plane: null,
    network_plane: null,
    security_baseline: [],
    observability_baseline: [],
    cost_control_baseline: [],
  };
}

function createEmptyRecommendation(): Recommendation {
  return {
    architecture_summary: {},
    required_resources: [],
    optional_resources: [],
    security_controls: [],
    cost_controls: [],
    risks: [],
    assumptions: [],
    terraform_modules: [],
    unresolved_questions: [],
  };
}

function collectMatchingRules(input: UserInput, rules: RulesArtifact): Rule[] {
  return Object.values(rules.rules)
    .flat()
    .filter((rule) => ruleMatches(input, rule))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
}

function ruleMatches(input: UserInput, rule: Rule): boolean {
  const whenAll = rule.when_all ? rule.when_all.every((condition) => conditionMatches(input, condition)) : true;
  const whenAny = rule.when_any ? rule.when_any.some((condition) => conditionMatches(input, condition)) : true;
  const unlessAny = rule.unless_any ? rule.unless_any.some((condition) => conditionMatches(input, condition)) : false;
  return whenAll && whenAny && !unlessAny;
}

function conditionMatches(input: UserInput, condition: Condition): boolean {
  const value = getPath(input, condition.path);
  if (value === undefined || value === "") {
    return false;
  }

  if ("equals" in condition) {
    return Array.isArray(value) ? value.includes(condition.equals as Primitive) : value === condition.equals;
  }

  if (condition.in) {
    return Array.isArray(value) ? value.some((item) => condition.in!.includes(item)) : condition.in.includes(value);
  }

  if ("contains" in condition) {
    return Array.isArray(value) ? value.includes(condition.contains as Primitive) : String(value).includes(String(condition.contains));
  }

  return false;
}

function mergeScalarPlanes(architecture: Architecture, rule: Rule): void {
  if (!rule.select) {
    return;
  }

  for (const plane of scalarPlanes) {
    const selected = rule.select[plane];
    if (selected && architecture[plane] === null) {
      architecture[plane] = selected;
    }
  }
}

function mergeRuleOutputs(recommendation: Recommendation, rule: Rule): void {
  if (rule.select?.required_resources) {
    recommendation.required_resources = unique([...recommendation.required_resources, ...rule.select.required_resources]);
  }

  for (const field of arrayFields) {
    const appendField = `append_${field}` as keyof Rule;
    const values = rule[appendField] as string[] | undefined;
    if (Array.isArray(values)) {
      recommendation[field] = unique([...recommendation[field], ...values]);
    }
  }

  if (rule.append_risks) {
    recommendation.risks = unique([...recommendation.risks, ...rule.append_risks]);
  }

  if (rule.requires_assumption) {
    recommendation.assumptions = unique([...recommendation.assumptions, rule.requires_assumption]);
  }
}

function deriveTerraformModules(architecture: Architecture, recommendation: Recommendation, rules: RulesArtifact): string[] {
  const moduleSet = new Set<string>();
  const requiredResources = new Set(recommendation.required_resources);

  if (
    architecture.network_plane ||
    architecture.compute_plane === "eks" ||
    ["rds", "aurora", "rds_or_aurora"].includes(architecture.data_plane ?? "") ||
    requiredResources.has("vpc") ||
    requiredResources.has("private_subnets") ||
    requiredResources.has("public_subnets") ||
    requiredResources.has("security_groups") ||
    requiredResources.has("alb")
  ) {
    moduleSet.add("network");
  }

  if (architecture.compute_plane === "lambda") {
    moduleSet.add("lambda_api");
  }

  if (architecture.compute_plane === "ecs_fargate") {
    moduleSet.add("ecs_service");
  }

  if (architecture.compute_plane === "eks") {
    moduleSet.add("eks_cluster");
    moduleSet.add("eks_node_groups");
  }

  if (architecture.ingress_plane) {
    const ingressPlane = architecture.ingress_plane;
    if (ingressPlane.includes("cloudfront") || ingressPlane === "cloudfront_s3") {
      moduleSet.add("static_site");
    }

    if (["apigw_http_api", "apigw_rest_api", "alb"].includes(ingressPlane)) {
      moduleSet.add("api_ingress");
    }
  }

  if (architecture.data_plane === "dynamodb") {
    moduleSet.add("dynamodb_table");
  }

  if (["rds", "aurora", "rds_or_aurora"].includes(architecture.data_plane ?? "")) {
    moduleSet.add("rds_postgres");
  }

  if (recommendation.security_controls.length > 0) {
    moduleSet.add("security_baseline");
  }

  const allowed = new Set(rules.terraform_generation.recommended_modules);
  return [...moduleSet].filter((moduleName) => allowed.has(moduleName));
}

function deriveUnresolvedQuestions(input: UserInput, architecture: Architecture, missingBlockers: string[], rules: RulesArtifact): string[] {
  const questions = missingBlockers.map((path) => `Provide ${labelFromPath(path)} before Terraform can be generated.`);

  if (!architecture.compute_plane && getPath(input, "workload.app_type") !== "static_site") {
    questions.push("Clarify workload packaging and execution model so a compute plane can be selected.");
  }

  if (requiresIngress(input) && !architecture.ingress_plane) {
    questions.push("Clarify access pattern so an ingress plane can be selected.");
  }

  if (requiresDataPlane(input) && !architecture.data_plane) {
    questions.push("Clarify persistent data needs so a data plane can be selected.");
  }

  if (requiresNetworkPlane(input) && !architecture.network_plane) {
    questions.push("Clarify private networking needs so a network plane can be selected.");
  }

  if (rules.terraform_generation.gate_on_unresolved_questions && getPath(input, "security_and_compliance.compliance") === "custom") {
    questions.push("Define the custom compliance controls before Terraform generation.");
  }

  return unique(questions);
}

function deriveRisks(input: UserInput, architecture: Architecture): string[] {
  const risks: string[] = [];

  if (architecture.compute_plane === "eks") {
    risks.push("EKS adds cluster lifecycle, upgrade, add-on, and Kubernetes security operations that must be owned explicitly.");
  }

  if (getPath(input, "traffic.internet_exposed") === "yes") {
    risks.push("Internet-exposed workloads require hardened ingress, logging, and public access review before production deployment.");
  }

  if (getPath(input, "cost.monthly_budget_band") === "minimal" && ["eks", "ec2", "rds", "aurora"].some((plane) => Object.values(architecture).includes(plane))) {
    risks.push("The selected architecture may not fit a minimal budget without right-sizing and environment scoping.");
  }

  if (getPath(input, "data.backups_required") === "no" && getPath(input, "data.primary_data_model") !== "none") {
    risks.push("Persistent data without backups creates recovery and compliance exposure.");
  }

  return risks;
}

function deriveObservabilityBaseline(input: UserInput): string[] {
  const baseline = ["cloudwatch_logs", "cloudwatch_metrics"];
  const required = getPath(input, "operations.logs_and_metrics_required");

  if (required === "enhanced" || required === "audit_grade") {
    baseline.push("structured_application_logs", "service_dashboards", "alarm_baselines");
  }

  if (required === "audit_grade") {
    baseline.push("centralized_audit_log_retention");
  }

  return baseline;
}

function hasSufficientArchitecture(input: UserInput, architecture: Architecture): boolean {
  const staticOnly = getPath(input, "workload.app_type") === "static_site";
  const computeOk = Boolean(architecture.compute_plane) || staticOnly;
  const ingressOk = !requiresIngress(input) || Boolean(architecture.ingress_plane);
  const dataOk = !requiresDataPlane(input) || Boolean(architecture.data_plane);
  const networkOk = !requiresNetworkPlane(input) || Boolean(architecture.network_plane);
  return computeOk && ingressOk && dataOk && networkOk;
}

function requiresIngress(input: UserInput): boolean {
  return getPath(input, "traffic.internet_exposed") === "yes" || ["public_api", "web_app", "static_site"].includes(String(getPath(input, "workload.app_type") ?? ""));
}

function requiresDataPlane(input: UserInput): boolean {
  const dataModel = getPath(input, "data.primary_data_model");
  return dataModel !== undefined && dataModel !== "" && dataModel !== "none";
}

function requiresNetworkPlane(input: UserInput): boolean {
  return (
    getPath(input, "networking.needs_vpc_private_resources") === "yes" ||
    getPath(input, "networking.private_connectivity_only") === "yes" ||
    getPath(input, "networking.on_prem_or_other_vpc_connectivity") === "yes"
  );
}

function getPath(input: UserInput, path: string): Primitive | Primitive[] | undefined {
  return path.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, input) as Primitive | Primitive[] | undefined;
}

function labelFromPath(path: string): string {
  return path
    .split(".")
    .map((part) => part.replaceAll("_", " "))
    .join(" / ");
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
