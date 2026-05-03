export type Primitive = string | number | boolean;

export type UserInput = Record<string, Record<string, Primitive | Primitive[] | undefined>>;

export type Condition = {
  path: string;
  equals?: Primitive;
  in?: Primitive[];
  contains?: Primitive;
};

export type Rule = {
  id: string;
  priority: number;
  when_all?: Condition[];
  when_any?: Condition[];
  unless_any?: Condition[];
  select?: {
    compute_plane?: string;
    ingress_plane?: string;
    data_plane?: string;
    network_plane?: string;
    required_resources?: string[];
    [key: string]: unknown;
  };
  append_required_resources?: string[];
  append_optional_resources?: string[];
  append_security_controls?: string[];
  append_cost_controls?: string[];
  append_assumptions?: string[];
  append_risks?: string[];
  requires_assumption?: string;
  notes?: string[];
};

export type RulesArtifact = {
  version: string;
  name: string;
  description: string;
  input_contract: Record<string, Record<string, Primitive[] | string>>;
  required_blockers: string[];
  intermediate_architecture_spec: string[];
  recommendation_output_contract: Record<string, string>;
  service_catalog: Record<string, string[]>;
  rules: Record<string, Rule[]>;
  terraform_generation: {
    gate_on_unresolved_questions: boolean;
    backend: {
      default: string;
      use_lockfile: boolean;
    };
    pin_versions: boolean;
    root_module_owns_provider_config: boolean;
    child_modules_declare_requirements_only: boolean;
    module_design_rules: string[];
    recommended_modules: string[];
  };
};

export type Architecture = {
  compute_plane: string | null;
  ingress_plane: string | null;
  data_plane: string | null;
  network_plane: string | null;
  security_baseline: string[];
  observability_baseline: string[];
  cost_control_baseline: string[];
};

export type Recommendation = {
  architecture_summary: Record<string, string | null>;
  required_resources: string[];
  optional_resources: string[];
  security_controls: string[];
  cost_controls: string[];
  risks: string[];
  assumptions: string[];
  terraform_modules: string[];
  unresolved_questions: string[];
};

export type EvaluationOutput = {
  validRules: boolean;
  schemaErrors: string[];
  missingBlockers: string[];
  matchedRuleIds: string[];
  architecture: Architecture;
  recommendation: Recommendation;
  terraformReady: boolean;
};
