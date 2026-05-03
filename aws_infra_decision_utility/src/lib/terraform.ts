import type { Architecture, EvaluationOutput, RulesArtifact, UserInput } from "./types";

export type TerraformFile = {
  path: string;
  content: string;
};

export function generateTerraform(input: UserInput, evaluation: EvaluationOutput, rules: RulesArtifact): string {
  return generateTerraformProject(input, evaluation, rules)
    .map((file) => `# ${file.path}\n${file.content}`)
    .join("\n\n");
}

export function generateTerraformProject(input: UserInput, evaluation: EvaluationOutput, rules: RulesArtifact): TerraformFile[] {
  if (!evaluation.terraformReady) {
    return [
      {
        path: "main.tf",
        content: "# Terraform generation is blocked until unresolved questions are cleared.",
      },
    ];
  }

  const modules = evaluation.recommendation.terraform_modules;
  const files: TerraformFile[] = [
    { path: "README.md", content: renderTerraformReadme(rules) },
    { path: "backend.hcl", content: renderBackendConfig() },
    { path: "terraform.tfvars.example", content: renderTfvarsExample(input) },
    { path: "versions.tf", content: renderVersions(rules) },
    { path: "variables.tf", content: renderRootVariables() },
    { path: "locals.tf", content: renderLocals(input, evaluation) },
    { path: "main.tf", content: renderRootModules(modules, evaluation) },
    { path: "outputs.tf", content: renderRootOutputs(modules) },
  ];

  for (const moduleName of modules) {
    files.push(...renderChildModule(moduleName, evaluation));
  }

  return files;
}

function renderVersions(rules: RulesArtifact): string {
  return `terraform {
  required_version = ">= 1.10.0"

  backend "${rules.terraform_generation.backend.default}" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}`;
}

function renderBackendConfig(): string {
  return `bucket       = "my-terraform-state-bucket"
key          = "aws-infra-decision-utility/terraform.tfstate"
region       = "us-east-1"
use_lockfile = true
encrypt      = true`;
}

function renderTfvarsExample(input: UserInput): string {
  const environments = input.workload?.environments ?? ["dev"];
  return `aws_region                  = "us-east-1"
name_prefix                 = "my-api-platform"
allowed_ingress_cidr_blocks = ["0.0.0.0/0"]
certificate_arn             = ""
domain_name                 = ""
db_master_username          = "app_admin"
db_master_password          = "change-me-use-a-secret-workflow"
lambda_artifact_path        = "./build/function.zip"
environments                = ${JSON.stringify(environments)}`;
}

function renderTerraformReadme(rules: RulesArtifact): string {
  return `# Generated AWS Terraform Project

This project was generated from the AWS Infrastructure Decision Utility rules artifact (${rules.name} ${rules.version}).

## Fill in project-specific values

1. Rename \`terraform.tfvars.example\` to \`terraform.tfvars\`.
2. Edit \`terraform.tfvars\` for your project names, AWS region, domain, certificate ARN, ingress CIDR ranges, and sensitive values.
3. Edit \`backend.hcl\` for your Terraform state bucket, state key, region, and lockfile setting.

## Initialize

\`\`\`bash
terraform init -backend-config=backend.hcl
\`\`\`

## Review

\`\`\`bash
terraform fmt -recursive
terraform validate
terraform plan -var-file=terraform.tfvars
\`\`\`

The generated files are a scaffold. Review names, IAM scope, secrets handling, network CIDRs, public exposure, and production safety settings before applying.`;
}

function renderRootVariables(): string {
  return `variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "name_prefix" {
  type    = string
  default = "aws-infra-decision"
}

variable "allowed_ingress_cidr_blocks" {
  type    = list(string)
  default = ["0.0.0.0/0"]
}

variable "certificate_arn" {
  type    = string
  default = ""
}

variable "domain_name" {
  type    = string
  default = ""
}

variable "db_master_username" {
  type    = string
  default = "app_admin"
}

variable "db_master_password" {
  type      = string
  sensitive = true
}

variable "lambda_artifact_path" {
  type    = string
  default = "./build/function.zip"
}

variable "environments" {
  type    = list(string)
  default = []
}`;
}

function renderLocals(input: UserInput, evaluation: EvaluationOutput): string {
  return `locals {
  environments       = length(var.environments) > 0 ? var.environments : ${JSON.stringify(input.workload?.environments ?? [])}
  architecture       = ${JSON.stringify(evaluation.recommendation.architecture_summary, null, 2)}
  required_resources = ${JSON.stringify(evaluation.recommendation.required_resources, null, 2)}
  security_controls  = ${JSON.stringify(evaluation.recommendation.security_controls, null, 2)}
}`;
}

function renderRootModules(moduleNames: string[], evaluation: EvaluationOutput): string {
  return moduleNames
    .map((moduleName) => renderRootModuleCall(moduleName, evaluation.architecture, moduleNames))
    .join("\n\n");
}

function renderRootModuleCall(moduleName: string, architecture: Architecture, moduleNames: string[]): string {
  const common = `module "${moduleName}" {
  source = "./modules/${moduleName}"`;
  const hasNetwork = moduleNames.includes("network");

  if (moduleName === "network") {
    return `${common}

  name_prefix   = var.name_prefix
  aws_region    = var.aws_region
  network_plane = "${architecture.network_plane}"
  environments  = local.environments
}`;
  }

  if (moduleName === "eks_cluster") {
    return `${common}

  name_prefix        = var.name_prefix
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
  master_username    = var.db_master_username
  master_password    = var.db_master_password
}`;
  }

  if (moduleName === "eks_node_groups") {
    return `${common}

  name_prefix        = var.name_prefix
  cluster_name       = module.eks_cluster.cluster_name
  cluster_role_arn   = module.eks_cluster.cluster_role_arn
  private_subnet_ids = module.network.private_subnet_ids
}`;
  }

  if (moduleName === "api_ingress") {
    return `${common}

  name_prefix                 = var.name_prefix
  ingress_plane               = "${architecture.ingress_plane}"
  compute_plane               = "${architecture.compute_plane}"
  vpc_id                      = ${hasNetwork ? "module.network.vpc_id" : `""`}
  public_subnet_ids           = ${hasNetwork ? "module.network.public_subnet_ids" : "[]"}
  allowed_ingress_cidr_blocks = var.allowed_ingress_cidr_blocks
  certificate_arn             = var.certificate_arn
}`;
  }

  if (moduleName === "rds_postgres") {
    return `${common}

  name_prefix        = var.name_prefix
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids
}`;
  }

  if (moduleName === "static_site") {
    return `${common}

  name_prefix     = var.name_prefix
  domain_name     = var.domain_name
  certificate_arn = var.certificate_arn
}`;
  }

  if (moduleName === "security_baseline") {
    return `${common}

  name_prefix                  = var.name_prefix
  enable_cloudtrail            = true
  enable_config                = true
  enable_guardduty             = true
  enable_security_hub          = true
  enable_inspector             = true
  enable_backup_vault          = true
  enable_budget_notifications  = true
}`;
  }

  if (moduleName === "lambda_api") {
    return `${common}

  name_prefix  = var.name_prefix
  artifact_path = var.lambda_artifact_path
  architecture = local.architecture
}`;
  }

  return `${common}

  name_prefix  = var.name_prefix
  architecture = local.architecture
}`;
}

function renderRootOutputs(moduleNames: string[]): string {
  const outputs = moduleNames
    .map((moduleName) => `output "${moduleName}" {
  value = module.${moduleName}
}`)
    .join("\n\n");

  return outputs || "# No module outputs selected.";
}

function renderChildModule(moduleName: string, evaluation: EvaluationOutput): TerraformFile[] {
  const resources = new Set(evaluation.recommendation.required_resources);
  const controls = new Set(evaluation.recommendation.security_controls);

  if (moduleName === "network") {
    return moduleFiles(moduleName, renderNetworkVariables(), renderNetworkMain(resources), renderNetworkOutputs());
  }

  if (moduleName === "eks_cluster") {
    return moduleFiles(moduleName, renderEksClusterVariables(), renderEksClusterMain(resources, controls), renderEksClusterOutputs());
  }

  if (moduleName === "eks_node_groups") {
    return moduleFiles(moduleName, renderEksNodeGroupsVariables(), renderEksNodeGroupsMain(), renderEksNodeGroupsOutputs());
  }

  if (moduleName === "api_ingress") {
    return moduleFiles(moduleName, renderApiIngressVariables(), renderApiIngressMain(resources), renderApiIngressOutputs());
  }

  if (moduleName === "rds_postgres") {
    return moduleFiles(moduleName, renderRdsVariables(), renderRdsMain(resources, controls), renderRdsOutputs());
  }

  if (moduleName === "dynamodb_table") {
    return moduleFiles(moduleName, renderNamePrefixVariables(), renderDynamoDbMain(), renderDynamoDbOutputs());
  }

  if (moduleName === "static_site") {
    return moduleFiles(moduleName, renderStaticSiteVariables(), renderStaticSiteMain(resources), renderStaticSiteOutputs());
  }

  if (moduleName === "security_baseline") {
    return moduleFiles(moduleName, renderSecurityBaselineVariables(), renderSecurityBaselineMain(controls), renderSecurityBaselineOutputs());
  }

  if (moduleName === "ecs_service" || moduleName === "lambda_api") {
    return moduleFiles(moduleName, moduleName === "lambda_api" ? renderLambdaVariables() : renderNamePrefixVariables(), renderPlaceholderComputeMain(moduleName), renderPlaceholderOutputs(moduleName));
  }

  return moduleFiles(moduleName, renderNamePrefixVariables(), "# Module implementation is not defined yet.", renderPlaceholderOutputs(moduleName));
}

function moduleFiles(moduleName: string, variables: string, main: string, outputs: string): TerraformFile[] {
  return [
    { path: `modules/${moduleName}/variables.tf`, content: variables },
    { path: `modules/${moduleName}/main.tf`, content: main },
    { path: `modules/${moduleName}/outputs.tf`, content: outputs },
  ];
}

function renderNamePrefixVariables(): string {
  return `variable "name_prefix" {
  type = string
}`;
}

function renderLambdaVariables(): string {
  return `${renderNamePrefixVariables()}

variable "artifact_path" {
  type = string
}`;
}

function renderNetworkVariables(): string {
  return `${renderNamePrefixVariables()}

variable "aws_region" {
  type = string
}

variable "network_plane" {
  type = string
}

variable "environments" {
  type    = list(string)
  default = []
}`;
}

function renderNetworkMain(resources: Set<string>): string {
  const includeNat = resources.has("nat_gateway");
  return `data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
  tags = {
    Project     = var.name_prefix
    ManagedBy   = "terraform"
    Environment = length(var.environments) > 0 ? join(",", var.environments) : "shared"
  }
}

resource "aws_vpc" "this" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, {
    Name = "\${var.name_prefix}-vpc"
  })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(local.tags, {
    Name = "\${var.name_prefix}-igw"
  })
}

resource "aws_subnet" "public" {
  count                   = length(local.azs)
  vpc_id                  = aws_vpc.this.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(aws_vpc.this.cidr_block, 8, count.index)
  map_public_ip_on_launch = false

  tags = merge(local.tags, {
    Name = "\${var.name_prefix}-public-\${count.index + 1}"
    Tier = "public-edge"
  })
}

resource "aws_subnet" "private" {
  count             = length(local.azs)
  vpc_id            = aws_vpc.this.id
  availability_zone = local.azs[count.index]
  cidr_block        = cidrsubnet(aws_vpc.this.cidr_block, 8, count.index + 10)

  tags = merge(local.tags, {
    Name = "\${var.name_prefix}-private-\${count.index + 1}"
    Tier = "private-application"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = merge(local.tags, {
    Name = "\${var.name_prefix}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

${includeNat ? renderNatGateway() : "# NAT gateway was not selected by the rules."}

resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.\${var.aws_region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = compact([try(aws_route_table.private[0].id, null)])

  tags = merge(local.tags, {
    Name = "\${var.name_prefix}-s3-endpoint"
  })
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.\${var.aws_region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = compact([try(aws_route_table.private[0].id, null)])

  tags = merge(local.tags, {
    Name = "\${var.name_prefix}-dynamodb-endpoint"
  })
}

resource "aws_security_group" "app" {
  name        = "\${var.name_prefix}-app"
  description = "Application private security group"
  vpc_id      = aws_vpc.this.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags, {
    Name = "\${var.name_prefix}-app-sg"
  })
}`;
}

function renderNatGateway(): string {
  return `resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "\${var.name_prefix}-nat-eip"
  }
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "\${var.name_prefix}-nat"
  }
}

resource "aws_route_table" "private" {
  count  = 1
  vpc_id = aws_vpc.this.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }

  tags = {
    Name = "\${var.name_prefix}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[0].id
}`;
}

function renderNetworkOutputs(): string {
  return `output "vpc_id" {
  value = aws_vpc.this.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "app_security_group_id" {
  value = aws_security_group.app.id
}`;
}

function renderEksClusterVariables(): string {
  return `${renderNamePrefixVariables()}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "master_username" {
  type = string
}

variable "master_password" {
  type      = string
  sensitive = true
}`;
}

function renderEksClusterMain(resources: Set<string>, controls: Set<string>): string {
  const logging = controls.has("control_plane_logging") ? `["api", "audit", "authenticator", "controllerManager", "scheduler"]` : `[]`;
  const kms = controls.has("kms_key_eks") ? renderEksKmsKey() : "# EKS KMS key was not selected by the security controls.";
  return `${kms}

data "aws_iam_policy_document" "eks_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "cluster" {
  name               = "\${var.name_prefix}-eks-cluster"
  assume_role_policy = data.aws_iam_policy_document.eks_assume_role.json
}

resource "aws_iam_role_policy_attachment" "cluster_policy" {
  role       = aws_iam_role.cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_security_group" "cluster" {
  name        = "\${var.name_prefix}-eks-cluster"
  description = "EKS cluster security group"
  vpc_id      = var.vpc_id
}

resource "aws_eks_cluster" "this" {
  name     = "\${var.name_prefix}-eks"
  role_arn = aws_iam_role.cluster.arn
  version  = "1.31"

  enabled_cluster_log_types = ${logging}

  vpc_config {
    subnet_ids              = var.private_subnet_ids
    security_group_ids      = [aws_security_group.cluster.id]
    endpoint_private_access = true
    endpoint_public_access  = false
  }

  ${controls.has("kms_key_eks") ? `encryption_config {
    provider {
      key_arn = aws_kms_key.eks[0].arn
    }
    resources = ["secrets"]
  }` : ""}

  depends_on = [aws_iam_role_policy_attachment.cluster_policy]
}

resource "aws_eks_addon" "vpc_cni" {
  count        = ${resources.has("vpc_cni") ? 1 : 0}
  cluster_name = aws_eks_cluster.this.name
  addon_name   = "vpc-cni"
}

data "tls_certificate" "cluster" {
  url = aws_eks_cluster.this.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "cluster" {
  count           = ${resources.has("oidc_provider") ? 1 : 0}
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.cluster.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.this.identity[0].oidc[0].issuer
}`;
}

function renderEksKmsKey(): string {
  return `resource "aws_kms_key" "eks" {
  count                   = 1
  description             = "KMS key for EKS secrets encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name = "\${var.name_prefix}-eks"
  }
}`;
}

function renderEksClusterOutputs(): string {
  return `output "cluster_name" {
  value = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "cluster_role_arn" {
  value = aws_iam_role.cluster.arn
}

output "oidc_provider_arn" {
  value = try(aws_iam_openid_connect_provider.cluster[0].arn, null)
}`;
}

function renderEksNodeGroupsVariables(): string {
  return `${renderNamePrefixVariables()}

variable "cluster_name" {
  type = string
}

variable "cluster_role_arn" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}`;
}

function renderEksNodeGroupsMain(): string {
  return `data "aws_iam_policy_document" "node_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "node" {
  name               = "\${var.name_prefix}-eks-node"
  assume_role_policy = data.aws_iam_policy_document.node_assume_role.json
}

resource "aws_iam_role_policy_attachment" "worker_node" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "cni" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "registry" {
  role       = aws_iam_role.node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_eks_node_group" "default" {
  cluster_name    = var.cluster_name
  node_group_name = "\${var.name_prefix}-default"
  node_role_arn   = aws_iam_role.node.arn
  subnet_ids      = var.private_subnet_ids

  scaling_config {
    desired_size = 2
    max_size     = 4
    min_size     = 2
  }

  update_config {
    max_unavailable = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.worker_node,
    aws_iam_role_policy_attachment.cni,
    aws_iam_role_policy_attachment.registry
  ]
}`;
}

function renderEksNodeGroupsOutputs(): string {
  return `output "node_role_arn" {
  value = aws_iam_role.node.arn
}

output "node_group_name" {
  value = aws_eks_node_group.default.node_group_name
}`;
}

function renderApiIngressVariables(): string {
  return `${renderNamePrefixVariables()}

variable "ingress_plane" {
  type = string
}

variable "compute_plane" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "allowed_ingress_cidr_blocks" {
  type = list(string)
}

variable "certificate_arn" {
  type = string
}`;
}

function renderApiIngressMain(resources: Set<string>): string {
  const albCount = resources.has("alb") ? 1 : 0;
  const httpApiCount = resources.has("apigw_http_api") ? 1 : 0;
  const restApiCount = resources.has("apigw_rest_api") ? 1 : 0;
  return `resource "aws_security_group" "ingress" {
  count       = ${albCount}
  name        = "\${var.name_prefix}-ingress"
  description = "Public ingress security group"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_ingress_cidr_blocks
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "this" {
  count              = ${albCount}
  name               = "\${var.name_prefix}-alb"
  load_balancer_type = "application"
  internal           = false
  subnets            = var.public_subnet_ids
  security_groups    = [aws_security_group.ingress[0].id]
}

resource "aws_apigatewayv2_api" "http" {
  count         = ${httpApiCount}
  name          = "\${var.name_prefix}-http-api"
  protocol_type = "HTTP"
}

resource "aws_api_gateway_rest_api" "rest" {
  count = ${restApiCount}
  name  = "\${var.name_prefix}-rest-api"
}

resource "aws_cloudfront_distribution" "api" {
  count   = ${resources.has("cloudfront_distribution") ? 1 : 0}
  enabled = true

  origin {
    domain_name = try(aws_lb.this[0].dns_name, "\${var.name_prefix}.execute-api.local")
    origin_id   = "api-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "api-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = true
      cookies {
        forward = "all"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.certificate_arn == ""
  }
}`;
}

function renderApiIngressOutputs(): string {
  return `output "alb_dns_name" {
  value = try(aws_lb.this[0].dns_name, null)
}

output "http_api_endpoint" {
  value = try(aws_apigatewayv2_api.http[0].api_endpoint, null)
}

output "rest_api_id" {
  value = try(aws_api_gateway_rest_api.rest[0].id, null)
}`;
}

function renderRdsVariables(): string {
  return `${renderNamePrefixVariables()}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}`;
}

function renderRdsMain(resources: Set<string>, controls: Set<string>): string {
  return `resource "aws_security_group" "db" {
  name        = "\${var.name_prefix}-db"
  description = "Database security group"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "this" {
  name       = "\${var.name_prefix}-db"
  subnet_ids = var.private_subnet_ids
}

resource "aws_secretsmanager_secret" "db" {
  count = ${resources.has("secrets_manager_secret") || controls.has("secrets_manager") ? 1 : 0}
  name  = "\${var.name_prefix}/database"
}

resource "aws_db_instance" "postgres" {
  identifier             = "\${var.name_prefix}-postgres"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = "db.t4g.medium"
  allocated_storage      = 50
  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.db.id]
  username               = var.master_username
  password               = var.master_password
  storage_encrypted      = ${controls.has("kms_encryption")}
  backup_retention_period = ${controls.has("backup") ? 7 : 1}
  deletion_protection    = ${resources.has("deletion_protection_on_stateful_services")}
  skip_final_snapshot    = false
}

resource "aws_db_proxy" "this" {
  count                  = ${resources.has("rds_proxy") ? 1 : 0}
  name                   = "\${var.name_prefix}-rds-proxy"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.rds_proxy[0].arn
  vpc_subnet_ids         = var.private_subnet_ids
  vpc_security_group_ids = [aws_security_group.db.id]

  auth {
    auth_scheme = "SECRETS"
    secret_arn  = aws_secretsmanager_secret.db[0].arn
    iam_auth    = "DISABLED"
  }
}

data "aws_iam_policy_document" "rds_proxy_assume_role" {
  count = ${resources.has("rds_proxy") ? 1 : 0}
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rds_proxy" {
  count              = ${resources.has("rds_proxy") ? 1 : 0}
  name               = "\${var.name_prefix}-rds-proxy"
  assume_role_policy = data.aws_iam_policy_document.rds_proxy_assume_role[0].json
}`;
}

function renderRdsOutputs(): string {
  return `output "db_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "db_security_group_id" {
  value = aws_security_group.db.id
}

output "rds_proxy_endpoint" {
  value = try(aws_db_proxy.this[0].endpoint, null)
}`;
}

function renderDynamoDbMain(): string {
  return `resource "aws_dynamodb_table" "this" {
  name         = "\${var.name_prefix}-table"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled = true
  }
}`;
}

function renderDynamoDbOutputs(): string {
  return `output "table_name" {
  value = aws_dynamodb_table.this.name
}`;
}

function renderStaticSiteVariables(): string {
  return `${renderNamePrefixVariables()}

variable "domain_name" {
  type = string
}

variable "certificate_arn" {
  type = string
}`;
}

function renderStaticSiteMain(resources: Set<string>): string {
  return `resource "aws_s3_bucket" "site" {
  bucket = "\${var.name_prefix}-site"
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "site" {
  count                             = ${resources.has("origin_access_control") ? 1 : 0}
  name                              = "\${var.name_prefix}-oac"
  description                       = "Origin access control for static site"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "site" {
  enabled = true

  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "site-origin"
    origin_access_control_id = try(aws_cloudfront_origin_access_control.site[0].id, null)
  }

  default_cache_behavior {
    target_origin_id       = "site-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.certificate_arn == ""
    acm_certificate_arn            = var.certificate_arn == "" ? null : var.certificate_arn
    ssl_support_method             = var.certificate_arn == "" ? null : "sni-only"
  }
}`;
}

function renderStaticSiteOutputs(): string {
  return `output "bucket_name" {
  value = aws_s3_bucket.site.bucket
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.site.domain_name
}`;
}

function renderSecurityBaselineVariables(): string {
  return `${renderNamePrefixVariables()}

variable "enable_cloudtrail" {
  type = bool
}

variable "enable_config" {
  type = bool
}

variable "enable_guardduty" {
  type = bool
}

variable "enable_security_hub" {
  type = bool
}

variable "enable_inspector" {
  type = bool
}

variable "enable_backup_vault" {
  type = bool
}

variable "enable_budget_notifications" {
  type = bool
}`;
}

function renderSecurityBaselineMain(controls: Set<string>): string {
  return `resource "aws_s3_bucket" "audit_logs" {
  count  = var.enable_cloudtrail ? 1 : 0
  bucket = "\${var.name_prefix}-audit-logs"
}

resource "aws_cloudtrail" "this" {
  count                         = var.enable_cloudtrail ? 1 : 0
  name                          = "\${var.name_prefix}-trail"
  s3_bucket_name                = aws_s3_bucket.audit_logs[0].bucket
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_logging                = true
}

resource "aws_config_configuration_recorder" "this" {
  count = var.enable_config ? 1 : 0
  name  = "\${var.name_prefix}-config"
  role_arn = aws_iam_role.config[0].arn
}

data "aws_iam_policy_document" "config_assume_role" {
  count = var.enable_config ? 1 : 0
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["config.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "config" {
  count              = var.enable_config ? 1 : 0
  name               = "\${var.name_prefix}-config"
  assume_role_policy = data.aws_iam_policy_document.config_assume_role[0].json
}

resource "aws_guardduty_detector" "this" {
  count  = var.enable_guardduty ? 1 : 0
  enable = true
}

resource "aws_securityhub_account" "this" {
  count = var.enable_security_hub ? 1 : 0
}

resource "aws_inspector2_enabler" "this" {
  count          = var.enable_inspector ? 1 : 0
  account_ids    = []
  resource_types = ["EC2", "ECR", "LAMBDA"]
}

resource "aws_backup_vault" "this" {
  count = (var.enable_backup_vault || ${controls.has("backup")}) ? 1 : 0
  name  = "\${var.name_prefix}-backup"
}

resource "aws_budgets_budget" "monthly" {
  count        = var.enable_budget_notifications ? 1 : 0
  name         = "\${var.name_prefix}-monthly"
  budget_type  = "COST"
  limit_amount = "1000"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
}`;
}

function renderSecurityBaselineOutputs(): string {
  return `output "cloudtrail_arn" {
  value = try(aws_cloudtrail.this[0].arn, null)
}

output "backup_vault_name" {
  value = try(aws_backup_vault.this[0].name, null)
}`;
}

function renderPlaceholderComputeMain(moduleName: string): string {
  if (moduleName === "lambda_api") {
    return `resource "aws_iam_role" "lambda" {
  name               = "\${var.name_prefix}-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_lambda_function" "this" {
  function_name = "\${var.name_prefix}-api"
  role          = aws_iam_role.lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  filename      = var.artifact_path
}`;
  }

  return `resource "aws_ecs_cluster" "this" {
  name = "\${var.name_prefix}-ecs"
}

resource "aws_ecr_repository" "app" {
  name = "\${var.name_prefix}-app"
}`;
}

function renderPlaceholderOutputs(moduleName: string): string {
  return `output "module_name" {
  value = "${moduleName}"
}`;
}
