import type { CandidateProfile, ResumeSection, SkillGroup } from "../types";

export type ResumeSource = "pdf" | "docx";

const skillAliases: Record<string, string> = {
  java: "Java",
  python: "Python",
  sql: "SQL",
  bash: "Bash",
  powershell: "PowerShell",
  curl: "cURL",
  groovy: "Groovy",
  "jenkins dsl": "Jenkins DSL",
  pip: "PIP",
  winget: "Winget",
  npm: "NPM",
  chocolatey: "Chocolatey",
  springboot: "Spring Boot",
  "spring boot": "Spring Boot",
  springframework: "Spring Framework",
  "spring framework": "Spring Framework",
  springcloud: "Spring Cloud",
  "spring cloud": "Spring Cloud",
  springweb: "Spring Web",
  "spring web": "Spring Web",
  "spring jpa": "Spring JPA",
  "spring security": "Spring Security",
  hibernate: "Hibernate",
  microservices: "Microservices",
  "restful api": "RESTful API",
  rest: "REST",
  webservices: "Web Services",
  "web services": "Web Services",
  jwt: "JWT",
  oauth2: "OAuth2",
  postman: "Postman",
  maven: "Maven",
  gradle: "Gradle",
  yaml: "YAML",
  yml: "YAML",
  "application properties": "Application Properties",
  git: "Git",
  github: "GitHub",
  gitbash: "Git Bash",
  "git bash": "Git Bash",
  bitbucket: "Bitbucket",
  json: "JSON",
  xml: "XML",
  junit: "JUnit",
  mockito: "Mockito",
  powermockito: "PowerMockito",
  selenium: "Selenium",
  "domain-driven design": "Domain-Driven Design",
  ddd: "DDD",
  "test-driven development": "Test-Driven Development",
  tdd: "TDD",
  kafka: "Apache Kafka",
  "apache kafka": "Apache Kafka",
  rabbitmq: "RabbitMQ",
  docker: "Docker",
  podman: "Podman",
  helm: "Helm",
  terraform: "Terraform",
  "terraform cloud foundry": "Terraform Cloud Foundry",
  spacelift: "Spacelift",
  cloudformation: "CloudFormation",
  aws: "AWS",
  "aws web services": "AWS",
  eks: "EKS",
  ecs: "ECS",
  ec2: "EC2",
  s3: "S3",
  elb: "ELB",
  vpc: "VPC",
  ssm: "SSM",
  codebuild: "CodeBuild",
  codedeploy: "CodeDeploy",
  codepipeline: "CodePipeline",
  codeapplication: "CodeApplication",
  iam: "IAM",
  "trust policies": "Trust Policies",
  "permission policies": "Permission Policies",
  "target groups": "Target Groups",
  "targe groups": "Target Groups",
  "secrets manager": "Secrets Manager",
  parameterstore: "Parameter Store",
  "parameter store": "Parameter Store",
  artifactory: "Artifactory",
  msk: "MSK",
  "kafka topic": "Kafka Topic",
  glue: "Glue",
  "glue schema": "Glue Schema",
  rds: "RDS",
  postgres: "Postgres",
  postgresql: "Postgres",
  dynamodb: "DynamoDB",
  redshift: "Redshift",
  cognito: "Cognito",
  forgerock: "ForgeRock",
  istio: "Istio",
  "service mesh": "Service Mesh",
  sidecar: "Sidecar",
  azure: "Azure",
  "microsoft azure": "Microsoft Azure",
  "microsoft entra id": "Microsoft Entra ID",
  sso: "SSO",
  jenkins: "Jenkins",
  cicd: "CI/CD",
  pipelines: "Pipelines",
  "github actions": "GitHub Actions",
  jfrog: "JFrog",
  "jfrog x-ray": "JFrog X-Ray",
  sonarcube: "SonarCube",
  jira: "Jira",
  confluence: "Confluence",
  "new relic": "New Relic",
  cloudwatch: "CloudWatch",
  splunk: "Splunk",
  datadog: "Datadog",
  grafana: "Grafana",
  openai: "OpenAI",
  codex: "Codex",
  chatgpt: "ChatGPT",
  "github copilot": "GitHub Copilot",
  prompting: "Prompting",
  gemini: "Gemini",
  "x ai": "xAI",
  anthropic: "Anthropic",
  claude: "Claude",
  "site reliability engineering": "Site Reliability Engineering",
  sre: "Site Reliability Engineering",
  agile: "Agile",
  waterfall: "Waterfall",
  windows: "Windows",
  unix: "UNIX",
  linux: "Linux"
};

const sectionAliases: Record<string, string> = {
  skills: "Skills",
  "technical skills": "Skills",
  experience: "Experience",
  employment: "Experience",
  "work history": "Experience",
  education: "Education",
  certifications: "Certifications",
  licenses: "Certifications",
  summary: "Summary",
  profile: "Summary",
  projects: "Projects"
};

const groupedSkillHeadings = new Set([
  "Skills",
  "AWS",
  "Azure",
  "IaC",
  "Operating Systems",
  "Environment",
  "Package Managers",
  "Vibe Coding",
  "Security Roles"
]);

const sanitizeInline = (value: string) => value.replace(/[ \t]+/g, " ").trim();

const normalizeResumeText = (value: string) =>
  value
    .replace(/\r/g, "\n")
    .replace(/\u2022/g, "\n• ")
    .replace(/\uF0B7/g, "\n• ")
    .replace(/\t/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => sanitizeInline(line))
    .join("\n")
    .trim();

const extractTextFromHtml = (html: string) => {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const lines: string[] = [];
  const blockSelector = "p, li, h1, h2, h3, h4, h5, h6, div";

  document.body.querySelectorAll(blockSelector).forEach((node) => {
    const text = sanitizeInline(node.textContent ?? "");
    if (!text) return;

    const prefix = node.tagName.toLowerCase() === "li" ? "• " : "";
    lines.push(`${prefix}${text}`);
  });

  if (lines.length > 0) {
    return normalizeResumeText(lines.join("\n"));
  }

  return normalizeResumeText(document.body.textContent ?? "");
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const normalizeHeading = (value: string) =>
  value.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

const prettifyHeading = (value: string) =>
  value
    .replace(/\([^)]*\)/g, "")
    .replace(/:$/, "")
    .trim()
    .replace(/\s+/g, " ");

const looksLikeMajorHeading = (line: string) => {
  const cleaned = prettifyHeading(line);
  if (!cleaned || cleaned.length > 48) return false;
  const canonical = sectionAliases[normalizeHeading(cleaned)];
  if (canonical) return true;
  return /^[A-Z][A-Za-z/& -]{2,}$/.test(cleaned) && cleaned === cleaned.replace(/[a-z]/g, "");
};

const toCanonicalHeading = (line: string) => {
  const cleaned = prettifyHeading(line);
  const normalized = normalizeHeading(cleaned);
  return sectionAliases[normalized] ?? cleaned;
};

const extractEmail = (text: string) => text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
const extractPhone = (text: string) =>
  text.match(/(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] ?? "";
const extractWebsite = (text: string) => text.match(/https?:\/\/\S+/i)?.[0] ?? "";

const knownStatusTokens = [
  "US Citizen",
  "Citizen",
  "Permanent Resident",
  "Green Card",
  "Visa",
  "Authorized to work",
  "Work Authorization"
];

const headerFieldPatterns = [
  /(?:^|\s)title\s*:\s*/i,
  /(?:^|\s)phone\s*:\s*/i,
  /(?:^|\s)email\s*:\s*/i,
  /(?:^|\s)location\s*:\s*/i,
  /(?:^|\s)website\s*:\s*/i
];

const inferName = (text: string) => {
  const firstLine = sanitizeInline(text.split("\n").find((line) => line.trim().length > 3) ?? "");
  return firstLine && firstLine.length <= 60 ? firstLine : "";
};

const inferLocation = (text: string) => text.match(/\b[A-Z][a-z]+,\s?[A-Z]{2}\b/)?.[0] ?? "";

const inferHeaderFields = (text: string, sections: ResumeSection[]) => {
  const lines = text.split("\n").map((line) => sanitizeInline(line)).filter(Boolean);
  const headerSection = sections.find((section) => section.heading === "Header");
  const headerLines = headerSection?.lines.length ? headerSection.lines : lines.slice(0, 12);
  const headerText = headerLines.join("\n");

  const firstNonLabeledLine =
    headerLines.find((line) => !/^[A-Za-z][A-Za-z ]+\s*[:\-]/.test(line)) ??
    lines.find((line) => !/^[A-Za-z][A-Za-z ]+\s*[:\-]/.test(line)) ??
    "";

  const findLineValue = (...labels: string[]) => {
    for (const line of headerLines) {
      for (const label of labels) {
        const match = line.match(new RegExp(`^${label}\\s*[:\\-]\\s*(.+)$`, "i"));
        if (match?.[1]) return sanitizeInline(match[1]);
      }
    }
    return "";
  };

  const extractUrlFromLine = (matcher: (line: string) => boolean) =>
    headerLines.find(matcher)?.match(/https?:\/\/\S+/i)?.[0] ?? "";

  const currentTitle =
    findLineValue("Current Title", "Title") ||
    (headerText.match(/(?:current\s+title|title)\s*[:\-]\s*(.+)$/im)?.[1] ?? "");
  const phone = findLineValue("Phone") || extractPhone(headerText);
  const email = findLineValue("Email") || extractEmail(headerText);
  const location = findLineValue("Location");
  const workAuthorization =
    findLineValue("Work Authorization", "Visa Status") ||
    (knownStatusTokens.find((token) => headerText.toLowerCase().includes(token.toLowerCase())) ?? "");
  const linkedIn =
    findLineValue("LinkedIn") ||
    extractUrlFromLine((line) => {
      const lower = line.toLowerCase();
      return lower.includes("linkedin") || (lower.startsWith("website") && lower.includes("linkedin.com"));
    });
  const website =
    findLineValue("Personal Website") ||
    extractUrlFromLine((line) => {
      const lower = line.toLowerCase();
      return lower.includes("personal website") || (lower.startsWith("website") && !lower.includes("linkedin.com"));
    });

  return {
    fullName: firstNonLabeledLine,
    currentTitle: sanitizeInline(currentTitle),
    phone,
    email,
    website,
    linkedIn,
    location,
    workAuthorization
  };
};

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findHeadingBoundary = (text: string, heading: string, fromIndex = 0) => {
  const pattern = new RegExp(
    String.raw`(?:^|[\n\r])\s*${escapePattern(heading)}\s*:?(?:[\n\r]+|$)`,
    "ig"
  );
  pattern.lastIndex = fromIndex;
  const match = pattern.exec(text);
  if (!match) return null;

  return {
    start: match.index,
    contentStart: pattern.lastIndex
  };
};

const extractExplicitSectionText = (text: string, headings: string[], stopHeadings: string[]) => {
  const normalized = text;
  const starts = headings
    .map((heading) => findHeadingBoundary(normalized, heading))
    .filter((value): value is { start: number; contentStart: number } => Boolean(value))
    .sort((left, right) => left.contentStart - right.contentStart);

  if (starts.length === 0) return "";

  const sectionStart = starts[0].contentStart;
  const stopIndexes = stopHeadings
    .map((heading) => findHeadingBoundary(normalized, heading, sectionStart))
    .filter((value): value is { start: number; contentStart: number } => Boolean(value))
    .map((value) => value.start)
    .filter((index) => index > sectionStart)
    .sort((left, right) => left - right);

  const sectionEnd = stopIndexes[0] ?? normalized.length;
  return normalized.slice(sectionStart, sectionEnd).trim();
};

const isNarrativeSummaryLine = (line: string) => {
  const trimmed = sanitizeInline(line);
  if (!trimmed) return false;
  if (trimmed.includes("@") || trimmed.includes("http")) return false;
  if (trimmed.includes("|")) return false;
  if (/^[•o]\s/.test(trimmed)) return false;
  if (looksLikeMajorHeading(trimmed)) return false;
  return trimmed.length >= 40;
};

const collectNarrativeBlock = (lines: string[]) => {
  const collected: string[] = [];

  for (const line of lines) {
    if (!line) {
      if (collected.length > 0) break;
      continue;
    }

    if (!isNarrativeSummaryLine(line)) {
      if (collected.length > 0) break;
      continue;
    }

    collected.push(sanitizeInline(line));
  }

  return collected.join(" ").trim();
};

const inferYears = (text: string, experienceSection?: ResumeSection) => {
  const direct = text.match(/(\d+)\+?\s+years? of experience/i);
  if (direct) return Number(direct[1]);

  const source = experienceSection?.lines.join("\n") ?? text;
  const years = Array.from(source.matchAll(/\b(19|20)\d{2}\b/g)).map((match) => Number(match[0]));
  if (years.length < 2) return 0;

  const currentYear = new Date().getFullYear();
  const earliest = Math.min(...years);
  return earliest > 1980 && earliest <= currentYear ? currentYear - earliest : 0;
};

const segmentSections = (text: string): ResumeSection[] => {
  const lines = text.split("\n").map((line) => line.trim());
  const sections: ResumeSection[] = [];
  let current: ResumeSection | null = null;

  for (const line of lines) {
    if (!line) {
      if (current && current.lines[current.lines.length - 1] !== "") {
        current.lines.push("");
      }
      continue;
    }

    if (looksLikeMajorHeading(line)) {
      current = { heading: toCanonicalHeading(line), lines: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { heading: "Header", lines: [] };
      sections.push(current);
    }

    current.lines.push(line);
  }

  return sections.map((section) => ({
    heading: section.heading,
    lines: section.lines.filter((line, index, values) => line || values[index - 1] !== "")
  }));
};

const normalizeSkillToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/^[•o]\s+/, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9+#/. -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripPrefix = (value: string) =>
  value.replace(
    /^(skills?|package managers?|operating systems?|environment|iac|aws web services \(aws\)|aws web services|aws|microsoft azure|security roles?|vibe coding)\s*:\s*/i,
    ""
  );

const detectInlineCategory = (line: string) => {
  const cleaned = line.replace(/^[•o]\s*/, "");
  const match = cleaned.match(
    /^(IaC|Package Managers|AWS Web Services \(AWS\)|AWS Web Services|AWS|Microsoft Azure|Operating Systems|Environment|Vibe Coding|Security Roles?)\s*:/i
  );
  if (!match) return null;

  const raw = match[1];
  if (/^aws/i.test(raw)) return "AWS";
  if (/^microsoft azure/i.test(raw)) return "Azure";
  if (/^security roles?/i.test(raw)) return "Security Roles";
  return prettifyHeading(raw);
};

const detectCategoryLabel = (line: string) => {
  const cleaned = line.replace(/^[•o]\s*/, "").trim();
  const match = cleaned.match(/^([^:]{2,40})\s*:\s*(.+)$/);
  if (!match) return null;

  return {
    category: prettifyHeading(match[1]),
    remainder: sanitizeInline(match[2])
  };
};

const canonicalizeSkill = (segment: string) => {
  const normalized = normalizeSkillToken(segment);
  if (!normalized) return "";
  if (/^\d+(?:\.\d+)?$/.test(normalized)) return "";

  if (skillAliases[normalized]) return skillAliases[normalized];

  for (const [alias, canonical] of Object.entries(skillAliases)) {
    if (normalized === alias || normalized.includes(alias)) {
      return canonical;
    }
  }

  if (/^[a-z0-9+/# .-]{2,50}$/i.test(segment) && !/:$/.test(segment)) {
    return sanitizeInline(segment);
  }

  return "";
};

const splitSkillSegments = (line: string) =>
  line
    .replace(/^[•o]\s*/, "")
    .split("|")
    .map((segment) => stripPrefix(segment.trim()))
    .flatMap((segment) => segment.split(/[;,]/))
    .map((segment) => sanitizeInline(segment))
    .filter(Boolean);

export const scanKnownSkills = (text: string) => {
  const found = new Set<string>();
  const normalizedText = normalizeSkillToken(text);

  for (const [alias, canonical] of Object.entries(skillAliases)) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, "i");
    if (pattern.test(normalizedText)) {
      found.add(canonical);
    }
  }

  return Array.from(found).sort((left, right) => left.localeCompare(right));
};

const parseSkillGroups = (sections: ResumeSection[]) => {
  const groups = new Map<string, Set<string>>();
  const skillsSection = sections.find((section) => section.heading === "Skills");
  const sourceSections = skillsSection ? [skillsSection] : sections.filter((section) => groupedSkillHeadings.has(section.heading));

  const ensureGroup = (category: string) => {
    if (!groups.has(category)) {
      groups.set(category, new Set<string>());
    }
    return groups.get(category)!;
  };

  for (const section of sourceSections) {
    let activeCategory = section.heading === "Skills" ? "Skills" : section.heading;

    for (const line of section.lines) {
      const nestedCategory = detectInlineCategory(line);
      if (nestedCategory) {
        activeCategory = nestedCategory;
      }

      const genericCategory = detectCategoryLabel(line);
      const normalizedLine = genericCategory ? genericCategory.remainder : line;
      if (genericCategory && section.heading === "Skills") {
        activeCategory = genericCategory.category;
      }

      const isBulletLike =
        /^[•o]/.test(line) || line.includes("|") || line.includes(",") || Boolean(nestedCategory) || Boolean(genericCategory);
      if (!isBulletLike && section.heading !== "Skills") {
        continue;
      }

      const segments = splitSkillSegments(normalizedLine);
      for (const segment of segments) {
        const skill = canonicalizeSkill(segment);
        if (skill) {
          ensureGroup(activeCategory).add(skill);
        }
      }
    }
  }

  const skillGroups: SkillGroup[] = Array.from(groups.entries())
    .map(([category, skills]) => ({
      category,
      skills: Array.from(skills).sort((left, right) => left.localeCompare(right))
    }))
    .filter((group) => group.skills.length > 0)
    .sort((left, right) => left.category.localeCompare(right.category));

  const fallbackSkills = scanKnownSkills(sections.flatMap((section) => section.lines).join("\n"));
  const flatSkills = unique([
    ...skillGroups.flatMap((group) => [group.category, ...group.skills]),
    ...fallbackSkills
  ]);

  if (skillGroups.length === 0 && fallbackSkills.length > 0) {
    return {
      skillGroups: [{ category: "Skills", skills: fallbackSkills }],
      flatSkills: unique(["Skills", ...fallbackSkills])
    };
  }

  return { skillGroups, flatSkills };
};

const inferTitles = (sections: ResumeSection[]) => {
  const experience = sections.find((section) => section.heading === "Experience");
  const lines = (experience?.lines ?? sections.flatMap((section) => section.lines))
    .map((line) => sanitizeInline(line))
    .filter(Boolean);

  return unique(
    lines.filter((line) =>
      ["manager", "analyst", "specialist", "coordinator", "director", "associate", "consultant", "engineer"].some((hint) =>
        line.toLowerCase().includes(hint)
      )
    )
  ).slice(0, 8);
};

const inferSummary = (text: string, sections: ResumeSection[], skills: string[]) => {
  const explicitSummaryText = extractExplicitSectionText(
    text,
    ["Summary", "Professional Summary", "Profile"],
    ["Skills", "Technical Skills", "Experience", "Professional Experience", "Education", "Certifications", "Projects"]
  );
  if (explicitSummaryText) {
    const explicitSummaryLines = explicitSummaryText
      .split("\n")
      .map((line) => sanitizeInline(line))
      .filter(Boolean);
    const explicitSummary = collectNarrativeBlock(explicitSummaryLines);
    if (explicitSummary) {
      return explicitSummary;
    }
  }

  const summarySection = sections.find((section) => section.heading === "Summary");
  if (summarySection?.lines.length) {
    const explicitSummary = collectNarrativeBlock(summarySection.lines);
    if (explicitSummary) {
      return explicitSummary;
    }
  }

  const headerSection = sections.find((section) => section.heading === "Header");
  const headerSummary = headerSection ? collectNarrativeBlock(headerSection.lines.slice(1)) : "";
  if (headerSummary) {
    return headerSummary;
  }

  const fallback = sections
    .filter((section) => section.heading !== "Header" && section.heading !== "Skills")
    .map((section) => collectNarrativeBlock(section.lines))
    .find(Boolean) ?? "";
  return fallback || `Candidate with experience in ${skills.slice(0, 4).join(", ")}.`;
};

const inferSectionLines = (sections: ResumeSection[], heading: string) =>
  sections.find((section) => section.heading === heading)?.lines.filter(Boolean).slice(0, 8) ?? [];

export const defaultProfile = (): CandidateProfile => ({
  fullName: "",
  currentTitle: "",
  email: "",
  phone: "",
  location: "",
  website: "",
  linkedIn: "",
  workAuthorization: "",
  summary: "",
  yearsExperience: 0,
  targetTitles: [],
  skills: [],
  workHistory: [],
  education: [],
  certifications: [],
  keywords: [],
  skillGroups: [],
  sections: [],
    preferences: {
      remoteOnly: false,
      preferredLocations: [],
      minimumSalary: undefined
    },
    diceSearch: {
      location: "Jacksonville, FL",
      workplaceTypes: [],
      postedDate: "SEVEN"
    },
    rawText: ""
  });

export async function extractResumeText(file: File): Promise<{ text: string; source: ResumeSource }> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "docx") {
    const mammoth = (await import("mammoth")).default;
    const arrayBuffer = await file.arrayBuffer();
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    const htmlText = extractTextFromHtml(htmlResult.value);

    if (htmlText) {
      return { text: htmlText, source: "docx" };
    }

    const rawTextResult = await mammoth.extractRawText({ arrayBuffer });
    return { text: normalizeResumeText(rawTextResult.value), source: "docx" };
  }

  if (extension === "pdf") {
    const pdfjsLib = await import("pdfjs-dist");
    const pdfWorker = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
    (
      pdfjsLib as typeof pdfjsLib & { GlobalWorkerOptions: { workerSrc: string } }
    ).GlobalWorkerOptions.workerSrc = pdfWorker;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const textItems = content.items
        .filter((item): item is typeof item & { str: string; transform: number[] } => "str" in item)
        .map((item) => ({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5]
        }))
        .filter((item) => item.text.trim());

      const sorted = textItems.sort((left, right) => {
        if (Math.abs(right.y - left.y) > 3) {
          return right.y - left.y;
        }
        return left.x - right.x;
      });

      const lines: { y: number; parts: { x: number; text: string }[] }[] = [];
      for (const item of sorted) {
        const existingLine = lines.find((line) => Math.abs(line.y - item.y) <= 3);
        if (existingLine) {
          existingLine.parts.push({ x: item.x, text: item.text });
        } else {
          lines.push({ y: item.y, parts: [{ x: item.x, text: item.text }] });
        }
      }

      const pageLines = lines
        .sort((left, right) => right.y - left.y)
        .map((line) =>
          line.parts
            .sort((left, right) => left.x - right.x)
            .map((part) => part.text)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
        )
        .filter(Boolean);

      pages.push(pageLines.join("\n"));
    }

    return { text: normalizeResumeText(pages.join("\n\n")), source: "pdf" };
  }

  throw new Error("Unsupported file type. Please upload a PDF or DOCX resume.");
}

export function parseResumeText(text: string): CandidateProfile {
  const normalizedText = normalizeResumeText(text);
  const sections = segmentSections(normalizedText);
  const { skillGroups, flatSkills } = parseSkillGroups(sections);
  const experienceSection = sections.find((section) => section.heading === "Experience");
  const headerFields = inferHeaderFields(normalizedText, sections);
  const location = headerFields.location || inferLocation(normalizedText);
  const targetTitles = inferTitles(sections);
  const keywords = unique([...flatSkills, ...targetTitles]).slice(0, 20);

  return {
    fullName: headerFields.fullName || inferName(normalizedText),
    currentTitle: headerFields.currentTitle,
    email: headerFields.email || extractEmail(normalizedText),
    phone: headerFields.phone || extractPhone(normalizedText),
    location,
    website: headerFields.website,
    linkedIn: headerFields.linkedIn,
    workAuthorization: headerFields.workAuthorization,
    summary: inferSummary(normalizedText, sections, flatSkills),
    yearsExperience: inferYears(normalizedText, experienceSection),
    targetTitles,
    skills: flatSkills,
    workHistory: inferSectionLines(sections, "Experience"),
    education: inferSectionLines(sections, "Education"),
    certifications: inferSectionLines(sections, "Certifications"),
    keywords,
    skillGroups,
    sections,
    preferences: {
      remoteOnly: false,
      preferredLocations: location ? [location] : [],
      minimumSalary: undefined
    },
    diceSearch: {
      location: "Jacksonville, FL",
      workplaceTypes: [],
      postedDate: "SEVEN"
    },
    rawText: normalizedText
  };
}
