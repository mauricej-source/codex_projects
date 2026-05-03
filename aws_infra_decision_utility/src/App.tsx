import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Cloud,
  Code2,
  Database,
  Download,
  FileCheck,
  HelpCircle,
  Lock,
  Network,
  Server,
  ShieldCheck,
} from "lucide-react";
import rulesData from "../decision_rules.json";
import schemaData from "../rules.schema.json";
import { evaluateInfrastructure } from "./lib/evaluator";
import { generateTerraform, generateTerraformProject, type TerraformFile } from "./lib/terraform";
import type { EvaluationOutput, Primitive, RulesArtifact, UserInput } from "./lib/types";

const rules = rulesData as RulesArtifact;
const schema = schemaData as object;
const storageKey = "aws-infra-decision-utility.answers";

const sectionIcons = {
  workload: Server,
  traffic: Cloud,
  data: Database,
  security_and_compliance: ShieldCheck,
  networking: Network,
  operations: ClipboardList,
  cost: FileCheck,
};

const planeIcons = {
  compute_plane: Server,
  ingress_plane: Cloud,
  data_plane: Database,
  network_plane: Network,
};

const sectionNames = Object.keys(rules.input_contract);
const helpView = "help";
type ActiveView = string | typeof helpView;
type FieldHelp = {
  description: string;
  examples?: string;
  options?: Record<string, string>;
};

const fieldHelp: Record<string, FieldHelp> = {
  "workload.app_type": {
    description: "The main shape of the application or job you want to run.",
    examples: "Use public API for customer-facing endpoints, web app for browser-based apps, worker for background processing, and static site for HTML/CSS/JS hosting.",
    options: {
      static_site: "A browser-delivered site made of static assets such as HTML, CSS, JavaScript, and images.",
      public_api: "An API intended to be reached from the public internet by users, browsers, mobile apps, or partners.",
      web_app: "A browser-based application with server-side behavior, such as dashboards, portals, or SaaS apps.",
      worker: "A background process that handles queued or scheduled work rather than direct user requests.",
      event_processor: "A workload triggered by events from services such as EventBridge, S3, queues, or streams.",
      internal_app: "An application intended for private users or internal networks rather than public internet access.",
      batch_job: "A job that runs periodically or on demand, processes a finite workload, then exits.",
    },
  },
  "workload.packaging": {
    description: "How your application is packaged before it is deployed.",
    examples: "This strongly influences Lambda, ECS, EC2, or EKS selection.",
    options: {
      source_only: "Code or static files without a container or VM image.",
      function: "A Lambda-style handler packaged as deployable function code.",
      container: "A Docker/OCI image that should run as a service or task.",
      vm: "A machine image or workload that needs server-level control.",
    },
  },
  "workload.runtime": {
    description: "The primary language or platform your application code runs on.",
    examples: "Choose other if the runtime is not listed or if the app is mostly packaged as a container.",
    options: {
      node: "JavaScript or TypeScript running on Node.js.",
      python: "Python application or function code.",
      java: "Java or JVM-based application code.",
      go: "Go application code compiled into a binary.",
      dotnet: ".NET application code, usually C#.",
      other: "Another runtime, mixed runtime, or a workload where runtime is abstracted by a container image.",
    },
  },
  "workload.statefulness": {
    description: "Whether the running compute needs to keep local state between requests.",
    examples: "Stateless workloads are easier to scale; shared files or stateful services usually require more infrastructure.",
    options: {
      stateless: "Requests can be handled by any instance without relying on local disk or memory from prior requests.",
      session_state: "The app tracks user/session state that may need an external store or cache.",
      shared_files: "Multiple compute instances need access to the same POSIX-style file system.",
      stateful_service: "The running service itself owns persistent state and may need careful placement, storage, or recovery design.",
    },
  },
  "workload.request_pattern": {
    description: "How work arrives and is handled by the system.",
    examples: "Synchronous means request/response. Asynchronous means queues, events, or background processing.",
    options: {
      synchronous: "A caller waits for an immediate response, such as an HTTP request.",
      asynchronous: "Work is submitted for later processing through events, queues, schedules, or background jobs.",
      mixed: "The workload has both direct request/response paths and background/event-driven processing.",
    },
  },
  "workload.max_execution_time": {
    description: "The longest one unit of work needs to run.",
    examples: "Lambda is best for short work; long-running services usually fit containers, EC2, or EKS better.",
    options: {
      short_under_15m: "Each unit of work completes within Lambda's 15-minute execution limit.",
      long_running: "The process may run continuously or individual tasks may exceed 15 minutes.",
    },
  },
  "workload.environments": {
    description: "The deployment stages you need Terraform to account for.",
    examples: "Production usually triggers stronger availability, monitoring, and safety defaults.",
    options: {
      dev: "A development environment for active engineering and testing.",
      staging: "A pre-production environment used for release validation.",
      prod: "A production environment serving real users or business workloads.",
    },
  },
  "workload.single_tenant_or_multi_tenant": {
    description: "Whether one customer or many customers share the same deployed system.",
    examples: "Multi-tenant systems often need stronger isolation, IAM boundaries, logging, and data partitioning.",
    options: {
      single: "One customer, business unit, or tenant uses the deployment.",
      multi: "Multiple tenants share the same platform or infrastructure boundary.",
    },
  },
  "workload.orchestration_preference": {
    description: "Whether you specifically need a container orchestrator or Kubernetes.",
    examples: "Choose none unless ECS or Kubernetes is a real requirement. Kubernetes-native can select EKS.",
    options: {
      none: "No explicit orchestrator requirement. The evaluator can choose the simplest suitable compute option.",
      ecs_native: "The workload should run on AWS ECS/Fargate rather than Lambda or EC2.",
      kubernetes_native: "The workload requires Kubernetes APIs, Helm charts, Operators, namespaces, or Kubernetes portability.",
    },
  },
  "workload.multi_tenancy_requirement": {
    description: "The level of tenant isolation required when multiple customers share the platform.",
    examples: "Namespace isolation implies Kubernetes-style tenant boundaries; cluster isolation is stronger and more expensive.",
    options: {
      none: "No special tenant isolation requirement beyond normal application and IAM controls.",
      namespace_isolation: "Tenants may be separated using Kubernetes namespaces or similar logical boundaries.",
      cluster_isolation: "Tenants require separate clusters or stronger infrastructure boundaries.",
    },
  },
  "workload.portability_priority": {
    description: "How important it is that workloads remain portable across Kubernetes-compatible platforms.",
    examples: "Provider native usually favors AWS managed services; Kubernetes standard can favor EKS.",
    options: {
      provider_native: "Prefer AWS-native managed services even if they are less portable to other clouds.",
      k8s_standard: "Prefer Kubernetes-standard deployment patterns for portability across Kubernetes platforms.",
    },
  },
  "traffic.internet_exposed": {
    description: "Whether users or systems can reach the workload from the public internet.",
    examples: "Public exposure affects ingress, WAF, subnet placement, and security controls.",
    options: {
      yes: "The workload has a public endpoint or serves public clients.",
      no: "The workload is private/internal and should not be directly reachable from the public internet.",
    },
  },
  "traffic.global_users": {
    description: "Whether users are spread across multiple geographic regions.",
    examples: "Global users can justify CloudFront or other edge delivery choices.",
    options: {
      yes: "Users are geographically distributed enough that edge delivery or global routing matters.",
      no: "Users are mostly in one region or latency is not materially affected by geography.",
    },
  },
  "traffic.estimated_rps": {
    description: "Approximate peak requests per second.",
    examples: "A rough estimate is enough. This helps reason about scale, cost, and throttling.",
  },
  "traffic.traffic_variability": {
    description: "How predictable the traffic pattern is.",
    examples: "Spiky or unpredictable traffic often favors serverless or autoscaling managed services.",
    options: {
      steady: "Traffic is relatively constant.",
      diurnal: "Traffic follows predictable daily peaks and valleys.",
      spiky: "Traffic has sharp bursts around launches, jobs, campaigns, or events.",
      unpredictable: "Traffic volume is hard to forecast.",
    },
  },
  "traffic.websocket_or_streaming": {
    description: "Whether the app needs long-lived connections, WebSockets, streaming responses, or similar behavior.",
    examples: "Long-lived connections can steer ingress and compute away from simple request/response defaults.",
    options: {
      yes: "The app needs WebSockets, server-sent events, streaming responses, or long-lived client connections.",
      no: "The app mostly uses normal short request/response interactions.",
    },
  },
  "traffic.latency_sensitivity": {
    description: "How strongly the workload cares about response time.",
    examples: "High sensitivity may require caching, regional placement, or avoiding cold-start-sensitive paths.",
    options: {
      low: "Seconds of response time may be acceptable for many interactions.",
      medium: "Normal interactive application response times matter.",
      high: "Low latency is a core requirement and may drive caching, compute, or network decisions.",
    },
  },
  "data.primary_data_model": {
    description: "The main kind of data the application stores.",
    examples: "Relational data points to RDS/Aurora. Key-value or document data often points to DynamoDB. Object data points to S3.",
    options: {
      none: "The workload does not need persistent application data.",
      key_value: "Data is mostly accessed by known keys, such as user ID, session ID, or item ID.",
      document: "Data is stored as flexible JSON-like documents.",
      relational: "Data needs SQL tables, relationships, joins, transactions, or reporting.",
      object: "Data is files/blobs such as images, uploads, exports, static assets, or backups.",
      file: "The app needs shared file-system semantics rather than object storage.",
      cache: "The main data need is fast temporary access, session cache, or hot-read offload.",
    },
  },
  "data.relational_features_needed": {
    description: "Whether the app needs SQL-like database capabilities.",
    examples: "Joins, transactions, and reporting usually indicate RDS or Aurora instead of DynamoDB.",
    options: {
      joins: "Queries need to combine related tables or entities.",
      transactions: "Multiple data changes must commit or roll back together.",
      reporting: "The app needs SQL-style reporting, aggregation, or analytical queries.",
      none: "The app does not need relational database features.",
    },
  },
  "data.read_write_profile": {
    description: "Whether the workload mostly reads, mostly writes, or does both evenly.",
    examples: "Read-heavy workloads may benefit from caching or read replicas later.",
    options: {
      read_heavy: "The workload performs many more reads than writes.",
      write_heavy: "The workload writes or ingests data heavily.",
      balanced: "Reads and writes are both significant.",
    },
  },
  "data.data_retention": {
    description: "How long data must be kept.",
    examples: "Long retention affects backup, lifecycle, encryption, and cost choices.",
    options: {
      short: "Data can be deleted quickly, such as temporary processing data.",
      medium: "Data must be kept for normal business use but not long-term archival.",
      long: "Data must be retained for long periods, audit, history, compliance, or recovery.",
    },
  },
  "data.backups_required": {
    description: "Whether stored data needs recoverable backups.",
    examples: "Production persistent data normally needs backups.",
    options: {
      yes: "Persistent data needs backup and recovery protection.",
      no: "Data can be recreated or loss is acceptable for this workload.",
    },
  },
  "data.disaster_recovery_tier": {
    description: "How much recovery capability is needed after an outage.",
    examples: "In-region high availability differs from cross-region disaster recovery in cost and complexity.",
    options: {
      none: "No explicit disaster recovery requirement beyond basic service durability.",
      in_region_ha: "The workload should survive common failures within one AWS region, typically using multi-AZ patterns.",
      cross_region: "The workload needs a recovery strategy in another AWS region.",
    },
  },
  "security_and_compliance.data_sensitivity": {
    description: "The sensitivity of the data the system handles.",
    examples: "Confidential or regulated data adds encryption, audit, governance, and protection controls.",
    options: {
      public: "Data is intended for public viewing and does not require confidentiality.",
      internal: "Data is for employees or internal systems but is not highly sensitive.",
      confidential: "Data includes business-sensitive, customer-sensitive, or private information.",
      regulated: "Data falls under formal regulatory or contractual controls.",
    },
  },
  "security_and_compliance.compliance": {
    description: "The compliance posture the architecture should assume.",
    examples: "Custom compliance will block Terraform until the exact control expectations are clarified.",
    options: {
      none: "No formal compliance framework is required.",
      soc2_like: "Controls should resemble SOC 2 expectations around access, logging, change control, and monitoring.",
      hipaa_like: "Controls should assume healthcare-style protection expectations for sensitive health data.",
      pci_like: "Controls should assume payment-card-style segmentation, logging, and protection expectations.",
      custom: "A custom compliance requirement exists and must be clarified before Terraform generation.",
    },
  },
  "security_and_compliance.encryption_customer_managed": {
    description: "Whether encryption keys must be customer-managed instead of AWS-managed defaults.",
    examples: "Customer-managed keys add KMS key policies, rotation, and operational responsibility.",
    options: {
      yes: "Use customer-managed KMS keys where supported.",
      no: "AWS-managed encryption defaults are acceptable.",
    },
  },
  "security_and_compliance.public_access_exceptions": {
    description: "Approved exceptions for public access.",
    examples: "S3 public access stays blocked unless an explicit approved public S3 exception is selected.",
    options: {
      none: "No public access exceptions are approved.",
      approved_public_s3: "An S3 bucket or object path is intentionally public.",
      public_api: "A public API endpoint is intentionally exposed.",
      public_alb: "A public Application Load Balancer is intentionally exposed.",
    },
  },
  "security_and_compliance.secret_types": {
    description: "The types of secrets the application needs.",
    examples: "Database passwords, API keys, and app secrets generally require Secrets Manager.",
    options: {
      none: "The app does not require stored runtime secrets.",
      app_secrets: "Application configuration secrets such as tokens or signing keys.",
      db_credentials: "Database usernames, passwords, or connection secrets.",
      api_keys: "External service API keys or partner credentials.",
    },
  },
  "security_and_compliance.human_access_model": {
    description: "How administrators and operators are allowed to access AWS resources.",
    examples: "Federated or break-glass-only access implies stronger IAM and audit expectations.",
    options: {
      console_ok: "Human access through the AWS console is acceptable with normal IAM controls.",
      federated_only: "Humans should access AWS through federation or SSO rather than local IAM users.",
      break_glass_only: "Direct privileged access should be reserved for emergency break-glass workflows.",
    },
  },
  "networking.needs_vpc_private_resources": {
    description: "Whether the workload must reach private databases, caches, or internal services in a VPC.",
    examples: "Private resources typically require private subnets and security groups.",
    options: {
      yes: "The workload needs private VPC resources such as RDS, ElastiCache, EFS, or private services.",
      no: "The workload can operate without private VPC resources.",
    },
  },
  "networking.outbound_internet_needed_from_private": {
    description: "Whether private workloads need outbound internet access for updates or external APIs.",
    examples: "This can add NAT gateways unless service endpoints avoid that need.",
    options: {
      yes: "Private compute needs to call public APIs, download updates, or reach internet services.",
      no: "Private compute does not need general outbound internet access.",
    },
  },
  "networking.private_connectivity_only": {
    description: "Whether the workload should be reachable only through private networks.",
    examples: "Use this for internal apps, private APIs, and workloads without public ingress.",
    options: {
      yes: "The workload should be reachable only through private networking paths.",
      no: "Public ingress may be acceptable if other answers require it.",
    },
  },
  "networking.on_prem_or_other_vpc_connectivity": {
    description: "Whether the architecture must connect to an on-premises network or another VPC.",
    examples: "This can introduce VPN, Direct Connect, Transit Gateway, or peering requirements later.",
    options: {
      yes: "Connectivity to another VPC, data center, office, or on-premises system is required.",
      no: "No external private network connectivity is required.",
    },
  },
  "networking.custom_cni_needed": {
    description: "Whether Kubernetes networking must use custom pod networking behavior.",
    examples: "This is an advanced requirement and can steer selection toward EKS.",
    options: {
      yes: "Kubernetes pod networking needs custom CNI behavior or specific IP allocation patterns.",
      no: "Default AWS networking patterns are acceptable.",
    },
  },
  "operations.team_ops_maturity": {
    description: "How much operational complexity the team can realistically own.",
    examples: "Low maturity favors managed services such as Lambda, Fargate, DynamoDB, and managed security baselines.",
    options: {
      low: "The team wants minimal infrastructure operations and prefers managed services.",
      medium: "The team can operate common AWS services with standard monitoring and runbooks.",
      high: "The team can own complex platforms such as Kubernetes, advanced networking, and deeper operational controls.",
    },
  },
  "operations.logs_and_metrics_required": {
    description: "The observability depth needed for the workload.",
    examples: "Audit-grade logging adds stronger retention, centralized logs, and review expectations.",
    options: {
      baseline: "Standard logs, metrics, and basic alarms are sufficient.",
      enhanced: "The workload needs dashboards, structured logs, and stronger operational alerting.",
      audit_grade: "Logs and metrics need audit-ready retention, governance, and reviewability.",
    },
  },
  "operations.change_frequency": {
    description: "How often the application or infrastructure changes.",
    examples: "High change frequency favors simple deployment paths and managed operational surfaces.",
    options: {
      low: "Changes are infrequent and stability matters more than release speed.",
      medium: "Changes happen regularly but not continuously.",
      high: "The workload changes often and needs efficient deployment and rollback paths.",
    },
  },
  "cost.monthly_budget_band": {
    description: "The rough monthly budget comfort zone.",
    examples: "Minimal budgets may conflict with fixed-cost services such as EKS, NAT gateways, or always-on databases.",
    options: {
      minimal: "Keep baseline spend as low as possible; avoid fixed-cost services unless required.",
      constrained: "Cost matters strongly, but some managed services or fixed costs may be acceptable.",
      moderate: "Balance cost with production readiness, security, and operational simplicity.",
      flexible: "Cost is secondary to capability, scale, resilience, or performance.",
    },
  },
  "cost.cost_priority": {
    description: "Whether to optimize first for lowest cost, balance, or performance.",
    examples: "Performance-first choices can increase baseline cost.",
    options: {
      lowest_possible: "Choose the lowest reasonable cost architecture, even if it limits capability or convenience.",
      balanced: "Balance cost, operational effort, security, and performance.",
      performance_first: "Prioritize throughput, latency, and headroom over lowest cost.",
    },
  },
  "cost.commitment_ok": {
    description: "Whether the team is willing to use cost commitments or interruptible capacity.",
    examples: "Savings Plans can reduce steady compute cost; Spot is useful only for interruption-tolerant workloads.",
    options: {
      none: "Do not assume reserved commitments or interruptible capacity.",
      savings_plans_ok: "Savings Plans or similar commitments are acceptable for steady usage.",
      spot_ok: "Spot or interruptible capacity is acceptable for workloads that can tolerate interruption.",
    },
  },
};

function App() {
  const [answers, setAnswers] = useState<UserInput>(() => loadStoredAnswers());
  const [activeView, setActiveView] = useState<ActiveView>(sectionNames[0]);
  const [reviewAccepted, setReviewAccepted] = useState(false);
  const [recommendationExpanded, setRecommendationExpanded] = useState(true);
  const [questionnaireExpanded, setQuestionnaireExpanded] = useState(true);
  const evaluation = useMemo<EvaluationOutput>(() => evaluateInfrastructure(answers, rules, schema), [answers]);
  const terraform = useMemo(() => generateTerraform(answers, evaluation, rules), [answers, evaluation]);
  const terraformFiles = useMemo(() => generateTerraformProject(answers, evaluation, rules), [answers, evaluation]);
  const activeSection = sectionNames.includes(activeView) ? activeView : sectionNames[0];
  const activeSectionIndex = sectionNames.indexOf(activeSection);
  const isHelp = activeView === helpView;

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(answers));
  }, [answers]);

  const completion = useMemo(() => {
    const total = sectionNames.reduce((count, section) => count + Object.keys(rules.input_contract[section]).length, 0);
    const filled = sectionNames.reduce((count, section) => {
      return count + Object.keys(rules.input_contract[section]).filter((field) => hasValue(answers[section]?.[field])).length;
    }, 0);
    return Math.round((filled / total) * 100);
  }, [answers]);

  const canGenerate = evaluation.terraformReady && reviewAccepted;
  const resetInputs = () => {
    setAnswers({});
    setReviewAccepted(false);
    localStorage.removeItem(storageKey);
    setActiveView(sectionNames[0]);
  };

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">
            <Cloud size={22} />
          </div>
          <div>
            <h1>AWS Infrastructure Decision Utility</h1>
            <p>Rules version {rules.version}</p>
          </div>
        </div>

        <div className="progressBlock">
          <div className="progressHeader">
            <span>Questionnaire</span>
            <strong>{completion}%</strong>
          </div>
          <div className="progressTrack">
            <div style={{ width: `${completion}%` }} />
          </div>
        </div>

        <nav className="sectionNav" aria-label="Application sections">
          <button
            className={isHelp ? "active" : ""}
            type="button"
            onClick={() => setActiveView(helpView)}
            title="Help"
          >
            <HelpCircle size={18} />
            <span>Help</span>
          </button>
          {sectionNames.map((name, index) => {
            const Icon = sectionIcons[name as keyof typeof sectionIcons] ?? ClipboardList;
            const complete = sectionComplete(name, answers);
            return (
              <button
                key={name}
                className={!isHelp && index === activeSectionIndex ? "active" : ""}
                type="button"
                onClick={() => setActiveView(name)}
                title={titleCase(name)}
              >
                <Icon size={18} />
                <span>{titleCase(name)}</span>
                {complete ? <Check size={16} className="check" /> : null}
              </button>
            );
          })}
        </nav>

        <StatusPanel evaluation={evaluation} />
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Spec first, Terraform second</p>
            <h2>{isHelp ? "Help" : titleCase(activeSection)}</h2>
          </div>
          <div className="topbarActions">
            <button type="button" className="resetButton" title="Reset inputs to the default blank state" onClick={resetInputs}>
              <AlertTriangle size={18} />
              Reset inputs
            </button>
            {!isHelp ? (
              <button
                type="button"
                className="resetButton"
                title={questionnaireExpanded ? "Collapse questionnaire" : "Expand questionnaire"}
                onClick={() => setQuestionnaireExpanded((value) => !value)}
                aria-expanded={questionnaireExpanded}
              >
                {questionnaireExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                {questionnaireExpanded ? "Collapse inputs" : "Expand inputs"}
              </button>
            ) : null}
          </div>
        </header>

        {isHelp ? (
          <HelpView />
        ) : (
          <>
            <div className="questionBand">
              {questionnaireExpanded ? (
                <>
                  <QuestionnaireSection section={activeSection} answers={answers} onChange={setAnswer(setAnswers)} />
                  <div className="wizardControls">
                    <button
                      type="button"
                      className="secondaryButton"
                      disabled={activeSectionIndex === 0}
                      onClick={() => setActiveView(sectionNames[activeSectionIndex - 1])}
                    >
                      <ChevronLeft size={18} />
                      Back
                    </button>
                    <button
                      type="button"
                      className="primaryButton"
                      disabled={activeSectionIndex === sectionNames.length - 1}
                      onClick={() => setActiveView(sectionNames[activeSectionIndex + 1])}
                    >
                      Next
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </>
              ) : (
                <QuestionnaireCollapsedSummary activeSection={activeSection} answers={answers} completion={completion} />
              )}
            </div>

            <RecommendationDashboard
              evaluation={evaluation}
              expanded={recommendationExpanded}
              onToggle={() => setRecommendationExpanded((value) => !value)}
            />

            <section className="reviewBand">
              <div>
                <p className="eyebrow">Review gate</p>
                <h2>Terraform Generation</h2>
                <p className="muted">
                  Terraform output is generated from the normalized architecture specification and remains blocked while required inputs or unresolved questions remain.
                </p>
              </div>
              <label className="reviewCheck">
                <input type="checkbox" checked={reviewAccepted} onChange={(event) => setReviewAccepted(event.target.checked)} />
                <span>I reviewed the recommendation, assumptions, risks, security controls, and cost controls.</span>
              </label>
              <TerraformPanel terraform={terraform} files={terraformFiles} canGenerate={canGenerate} evaluation={evaluation} />
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function HelpView() {
  return (
    <section className="helpBand">
      <div className="helpHero">
        <div>
          <p className="eyebrow">End user guide</p>
          <h2>How to get from intent to Terraform</h2>
          <p>
            This utility turns structured workload answers into an AWS architecture recommendation first. Terraform is generated only after the required inputs,
            unresolved questions, assumptions, risks, security controls, and cost controls have been reviewed.
          </p>
        </div>
      </div>

      <div className="helpSteps">
        <article>
          <span>1</span>
          <h3>Complete the questionnaire</h3>
          <p>Work through Workload, Traffic, Data, Security and Compliance, Networking, Operations, and Cost. Fields marked Required are generation blockers.</p>
        </article>
        <article>
          <span>2</span>
          <h3>Watch the status panel</h3>
          <p>The lower-left status tells you whether Terraform is blocked or ready. Blocked means a required answer or architecture decision is still missing.</p>
        </article>
        <article>
          <span>3</span>
          <h3>Review the recommendation</h3>
          <p>Confirm the selected compute, ingress, data, and network planes. The matched rules explain which source-of-truth decision rules were applied.</p>
        </article>
        <article>
          <span>4</span>
          <h3>Clear unresolved questions</h3>
          <p>If unresolved questions appear, update the questionnaire until the list is empty. Terraform generation remains intentionally gated while this list has items.</p>
        </article>
        <article>
          <span>5</span>
          <h3>Accept the review gate</h3>
          <p>After reviewing assumptions, risks, security controls, and cost controls, check the review box to enable Terraform output actions.</p>
        </article>
      </div>

      <div className="faqGrid">
        <HelpCard
          title="What should I answer if I am unsure?"
          text="Use the option that best reflects the current requirement, then check the recommendation and unresolved questions. Avoid choosing advanced options such as Kubernetes-native unless they are genuinely required."
        />
        <HelpCard
          title="Why is Terraform blocked?"
          text="Terraform is blocked when required blocker fields are missing, rules cannot select enough architecture planes, custom compliance details are unresolved, or the review gate has not been accepted."
        />
        <HelpCard
          title="What are architecture planes?"
          text="Planes are the normalized spec used before Terraform: compute, ingress, data, and network. They keep the app recommendation-first instead of generating code directly from raw form fields."
        />
        <HelpCard
          title="What do matched rules mean?"
          text="Matched rules are the decision rules from decision_rules.json that applied to your answers. Higher-priority rules resolve scalar architecture choices such as compute or ingress."
        />
        <HelpCard
          title="Are risks and assumptions optional?"
          text="No. They are part of the recommendation review. The generated Terraform should be treated as a starting module composition that still needs environment-specific names, account choices, and production review."
        />
        <HelpCard
          title="When should I copy Terraform?"
          text="Copy Terraform only after the utility shows Terraform ready and the review checkbox is selected. The output is based on the resolved architecture specification and recommended module boundaries."
        />
      </div>

      <div className="questionHelp">
        <div className="sectionIntro">
          <p className="eyebrow">Questionnaire reference</p>
          <h2>What each input means</h2>
        </div>
        {sectionNames.map((section) => (
          <article className="questionHelpSection" key={section}>
            <h3>{titleCase(section)}</h3>
            <div className="questionHelpGrid">
              {Object.keys(rules.input_contract[section]).map((field) => {
                const help = fieldHelp[`${section}.${field}`];
                return (
                  <div className="questionHelpItem" key={field}>
                    <h4>{titleCase(field)}</h4>
                    <p>{help?.description ?? "No guidance is currently defined for this input."}</p>
                    {help?.examples ? <p className="helpExample">{help.examples}</p> : null}
                    {help?.options ? (
                      <dl>
                        {Object.entries(help.options).map(([option, meaning]) => (
                          <div key={option}>
                            <dt>{formatOption(option)}</dt>
                            <dd>{meaning}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HelpCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="helpCard">
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function QuestionnaireSection({
  section,
  answers,
  onChange,
}: {
  section: string;
  answers: UserInput;
  onChange: (section: string, field: string, value: Primitive | Primitive[]) => void;
}) {
  const fields = rules.input_contract[section];

  return (
    <section>
      <div className="sectionIntro">
        <p className="eyebrow">Input contract</p>
        <h3>{titleCase(section)}</h3>
      </div>
      <div className="fieldGrid">
        {Object.entries(fields).map(([field, contract]) => (
          <FieldControl
            key={field}
            section={section}
            field={field}
            contract={contract}
            value={answers[section]?.[field]}
            required={rules.required_blockers.includes(`${section}.${field}`)}
            onChange={onChange}
          />
        ))}
      </div>
    </section>
  );
}

function QuestionnaireCollapsedSummary({
  activeSection,
  answers,
  completion,
}: {
  activeSection: string;
  answers: UserInput;
  completion: number;
}) {
  const answeredInSection = Object.keys(rules.input_contract[activeSection]).filter((field) => hasValue(answers[activeSection]?.[field])).length;
  const totalInSection = Object.keys(rules.input_contract[activeSection]).length;
  const blockersRemaining = rules.required_blockers.filter((path) => {
    const [section, field] = path.split(".");
    return !hasValue(answers[section]?.[field]);
  }).length;

  return (
    <div className="collapsedSummary">
      <span>{titleCase(activeSection)}</span>
      <span>{answeredInSection} of {totalInSection} answered in this section</span>
      <span>{completion}% questionnaire complete</span>
      <span>{blockersRemaining} required blockers remaining</span>
    </div>
  );
}

function FieldControl({
  section,
  field,
  contract,
  value,
  required,
  onChange,
}: {
  section: string;
  field: string;
  contract: Primitive[] | string;
  value: Primitive | Primitive[] | undefined;
  required: boolean;
  onChange: (section: string, field: string, value: Primitive | Primitive[]) => void;
}) {
  const label = titleCase(field);

  if (Array.isArray(contract)) {
    const multi = field === "environments";
    return (
      <label className="field">
        <span>
          {label}
          {required ? <b>Required</b> : null}
        </span>
        {multi ? (
          <div className="toggleGroup">
            {contract.map((option) => {
              const selected = Array.isArray(value) && value.includes(option);
              return (
                <button
                  key={String(option)}
                  type="button"
                  className={selected ? "selected" : ""}
                  onClick={() => onChange(section, field, toggleArrayValue(value, option))}
                >
                  {formatOption(option)}
                </button>
              );
            })}
          </div>
        ) : (
          <select value={String(value ?? "")} onChange={(event) => onChange(section, field, normalizeValue(event.target.value, contract))}>
            <option value="">Select</option>
            {contract.map((option) => (
              <option key={String(option)} value={String(option)}>
                {formatOption(option)}
              </option>
            ))}
          </select>
        )}
      </label>
    );
  }

  if (contract === "integer") {
    return (
      <label className="field">
        <span>
          {label}
          {required ? <b>Required</b> : null}
        </span>
        <input
          type="number"
          min="0"
          value={typeof value === "number" ? value : ""}
          onChange={(event) => onChange(section, field, Number(event.target.value))}
          placeholder="0"
        />
      </label>
    );
  }

  return (
    <label className="field">
      <span>
        {label}
        {required ? <b>Required</b> : null}
      </span>
      <input value={String(value ?? "")} onChange={(event) => onChange(section, field, event.target.value)} />
    </label>
  );
}

function StatusPanel({ evaluation }: { evaluation: EvaluationOutput }) {
  return (
    <div className={evaluation.terraformReady ? "status ready" : "status blocked"}>
      <div>
        {evaluation.terraformReady ? <Check size={18} /> : <Lock size={18} />}
        <strong>{evaluation.terraformReady ? "Terraform ready" : "Generation blocked"}</strong>
      </div>
      <p>
        {evaluation.terraformReady
          ? "All required inputs are present and the architecture spec is complete."
          : `${evaluation.recommendation.unresolved_questions.length || evaluation.missingBlockers.length} item(s) require review.`}
      </p>
    </div>
  );
}

function RecommendationDashboard({
  evaluation,
  expanded,
  onToggle,
}: {
  evaluation: EvaluationOutput;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="recommendationBand">
      <div className="sectionIntro collapsibleHeader">
        <div>
          <p className="eyebrow">Evaluator output</p>
          <h2>Recommendation</h2>
        </div>
        <button type="button" className="secondaryButton" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded ? (
        <>
          {!evaluation.validRules ? (
            <IssueList title="Rules schema errors" items={evaluation.schemaErrors} tone="danger" />
          ) : null}

          <div className="planeGrid">
            {(["compute_plane", "ingress_plane", "data_plane", "network_plane"] as const)
              .map((key) => {
                const value = evaluation.architecture[key];
                const Icon = planeIcons[key as keyof typeof planeIcons] ?? Server;
                return (
                  <article className="planeTile" key={key}>
                    <Icon size={20} />
                    <span>{titleCase(key)}</span>
                    <strong>{value ? formatOption(value) : "Unresolved"}</strong>
                  </article>
                );
              })}
          </div>

          <div className="detailGrid">
            <ListBlock title="Required resources" items={evaluation.recommendation.required_resources} />
            <ListBlock title="Security controls" items={evaluation.recommendation.security_controls} />
            <ListBlock title="Cost controls" items={evaluation.recommendation.cost_controls} />
            <ListBlock title="Terraform modules" items={evaluation.recommendation.terraform_modules} />
          </div>

          <div className="detailGrid">
            <ListBlock title="Matched rules" items={evaluation.matchedRuleIds} compact />
            <ListBlock title="Assumptions" items={evaluation.recommendation.assumptions} />
            <ListBlock title="Risks" items={evaluation.recommendation.risks} />
            <ListBlock title="Unresolved questions" items={evaluation.recommendation.unresolved_questions} tone="warning" />
          </div>
        </>
      ) : (
        <div className="collapsedSummary">
          <span>{evaluation.architecture.compute_plane ? formatOption(evaluation.architecture.compute_plane) : "Compute unresolved"}</span>
          <span>{evaluation.architecture.ingress_plane ? formatOption(evaluation.architecture.ingress_plane) : "Ingress unresolved"}</span>
          <span>{evaluation.architecture.data_plane ? formatOption(evaluation.architecture.data_plane) : "Data unresolved"}</span>
          <span>{evaluation.recommendation.terraform_modules.length} Terraform modules</span>
          <span>{evaluation.recommendation.unresolved_questions.length} unresolved</span>
        </div>
      )}
    </section>
  );
}

function TerraformPanel({
  terraform,
  files,
  canGenerate,
  evaluation,
}: {
  terraform: string;
  files: TerraformFile[];
  canGenerate: boolean;
  evaluation: EvaluationOutput;
}) {
  const [copied, setCopied] = useState(false);
  const [selectedPath, setSelectedPath] = useState(files[0]?.path ?? "main.tf");
  const selectedFile = files.find((file) => file.path === selectedPath) ?? files[0];

  useEffect(() => {
    if (!files.some((file) => file.path === selectedPath)) {
      setSelectedPath(files[0]?.path ?? "main.tf");
    }
  }, [files, selectedPath]);

  async function copyTerraform() {
    await navigator.clipboard.writeText(selectedFile?.content ?? terraform);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function copyProject() {
    await navigator.clipboard.writeText(terraform);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function downloadProjectZip() {
    const zip = new JSZip();

    for (const file of files) {
      zip.file(file.path, file.content);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aws-infra-terraform-project.zip";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="terraformPanel">
      <div className="terraformToolbar">
        <span>
          <Code2 size={18} />
          {selectedFile?.path ?? "main.tf"}
        </span>
        <div className="terraformActions">
          <button type="button" className="secondaryButton" disabled={!canGenerate} onClick={copyTerraform}>
            <Download size={18} />
            {copied ? "Copied" : "Copy file"}
          </button>
          <button type="button" className="secondaryButton" disabled={!canGenerate} onClick={copyProject}>
            <Download size={18} />
            Copy project text
          </button>
          <button type="button" className="primaryButton" disabled={!canGenerate} onClick={downloadProjectZip}>
            <Download size={18} />
            Download zip
          </button>
        </div>
      </div>
      {!canGenerate && evaluation.terraformReady ? <p className="gateMessage">Complete the review checkbox to enable Terraform output actions.</p> : null}
      <div className="terraformBrowser">
        <nav className="fileList" aria-label="Generated Terraform files">
          {files.map((file) => (
            <button
              key={file.path}
              type="button"
              className={file.path === selectedFile?.path ? "active" : ""}
              onClick={() => setSelectedPath(file.path)}
            >
              {file.path}
            </button>
          ))}
        </nav>
        <pre className={!canGenerate ? "disabledCode" : ""}>
          <code>{selectedFile?.content ?? terraform}</code>
        </pre>
      </div>
    </div>
  );
}

function IssueList({ title, items, tone }: { title: string; items: string[]; tone: "danger" | "warning" }) {
  return (
    <div className={`issueList ${tone}`}>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function ListBlock({ title, items, compact = false, tone }: { title: string; items: string[]; compact?: boolean; tone?: "warning" }) {
  return (
    <article className={`listBlock ${tone ?? ""}`}>
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul className={compact ? "compactList" : ""}>
          {items.map((item) => (
            <li key={item}>{formatOption(item)}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">None yet</p>
      )}
    </article>
  );
}

function setAnswer(setAnswers: React.Dispatch<React.SetStateAction<UserInput>>) {
  return (section: string, field: string, value: Primitive | Primitive[]) => {
    setAnswers((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  };
}

function loadStoredAnswers(): UserInput {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as UserInput) : {};
  } catch {
    return {};
  }
}

function sectionComplete(section: string, answers: UserInput): boolean {
  return Object.keys(rules.input_contract[section]).every((field) => hasValue(answers[section]?.[field]));
}

function hasValue(value: Primitive | Primitive[] | undefined): boolean {
  return value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function toggleArrayValue(value: Primitive | Primitive[] | undefined, option: Primitive): Primitive[] {
  const current = Array.isArray(value) ? value : [];
  return current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
}

function normalizeValue(value: string, options: Primitive[]): Primitive {
  const matched = options.find((option) => String(option) === value);
  return matched ?? value;
}

function titleCase(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatOption(value: Primitive | null): string {
  if (value === null) {
    return "Unresolved";
  }

  return String(value)
    .replaceAll("_", " ")
    .replaceAll("apigw", "API Gateway")
    .replaceAll("rds", "RDS")
    .replaceAll("eks", "EKS")
    .replaceAll("ecs", "ECS")
    .replaceAll("ec2", "EC2")
    .replaceAll("s3", "S3")
    .replaceAll("iam", "IAM")
    .replaceAll("kms", "KMS")
    .replaceAll("waf", "WAF");
}

export default App;
