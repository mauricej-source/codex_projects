import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  buildDiceQueryPreview
} from "../../src/lib/diceQuery.js";
import type { CandidateProfile, JobListing, JobSearchResponse, WorkMode } from "../../src/types.js";
import type { JobProvider } from "./types.js";

type JsonObject = Record<string, unknown>;

type ToolDefinition = {
  name: string;
  inputSchema?: {
    properties?: Record<string, unknown>;
  };
};

const DEFAULT_DICE_MCP_URL = process.env.DICE_MCP_URL || "https://mcp.dice.com/mcp";
const AI_DISCLOSURE =
  "These job listings were found using AI-powered search. Please review all job details carefully and verify information directly with employers before applying.";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function coerceString(value: unknown) {
  return typeof value === "string" ? normalizeWhitespace(value) : "";
}

function coerceStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => (typeof entry === "string" ? [normalizeWhitespace(entry)] : []));
  }

  if (typeof value === "string") {
    return value
      .split(/[|,]/)
      .map((entry) => normalizeWhitespace(entry))
      .filter(Boolean);
  }

  return [];
}

function normalizeWorkMode(value: string): WorkMode {
  const normalized = value.toLowerCase();

  if (normalized.includes("remote")) return "Remote";
  if (normalized.includes("hybrid")) return "Hybrid";
  return "On-site";
}

function extractToolText(result: { content?: Array<{ type: string; text?: string }>; structuredContent?: unknown }) {
  const textParts =
    result.content
      ?.filter((item): item is { type: "text"; text: string } => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text) ?? [];

  if (textParts.length > 0) {
    return textParts.join("\n");
  }

  if (typeof result.structuredContent === "string") {
    return result.structuredContent;
  }

  return "";
}

function pickFirstString(record: JsonObject, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return normalizeWhitespace(value);
    }
  }

  return "";
}

function pickFirstList(record: JsonObject, keys: string[]) {
  for (const key of keys) {
    const values = coerceStringList(record[key]);
    if (values.length > 0) {
      return values;
    }
  }

  return [];
}

function parseDiceJob(record: JsonObject, index: number): JobListing | null {
  const title = pickFirstString(record, ["title", "jobTitle", "positionTitle"]);
  const company = pickFirstString(record, ["company", "companyName", "employer"]);
  const url = pickFirstString(record, ["detailsPageUrl", "url", "jobUrl", "applyUrl", "detailUrl"]);

  if (!title || !company || !url) {
    return null;
  }

  const nestedLocation =
    typeof record.jobLocation === "object" && record.jobLocation !== null
      ? pickFirstString(record.jobLocation as JsonObject, ["displayName"])
      : "";
  const location =
    nestedLocation || pickFirstString(record, ["location", "displayLocation", "jobLocation"]) || "Remote";
  const description =
    pickFirstString(record, ["description", "snippet", "summary", "teaser"]) || "No description provided.";
  const tags = pickFirstList(record, ["skills", "tags", "technologies", "keywords", "workplaceTypes"]);
  const postedDate =
    pickFirstString(record, ["postedDate", "datePosted", "posted_at", "createdDate"]).slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  const salary = pickFirstString(record, ["salary", "salaryText", "compensation"]);
  const workMode = normalizeWorkMode(
    [
      ...pickFirstList(record, ["workplaceTypes"]),
      pickFirstString(record, ["workplaceType", "workMode", "remoteType", "locationType"]),
      record.isRemote === true ? "Remote" : ""
    ]
      .filter(Boolean)
      .join(" ")
  );
  const id =
    pickFirstString(record, ["id", "jobId", "positionId"]) ||
    `${title}-${company}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return {
    id: `dice-${id}`,
    title,
    company,
    location,
    workMode,
    description,
    source: "Dice",
    url,
    postedDate,
    salary: salary || undefined,
    tags
  };
}

function extractJobsFromStructuredContent(value: unknown): JsonObject[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter((entry): entry is JsonObject => typeof entry === "object" && entry !== null);
  }

  if (typeof value === "object") {
    const record = value as JsonObject;
    const candidateKeys = ["jobs", "results", "items", "listings", "data"];

    for (const key of candidateKeys) {
      const nested = record[key];
      if (Array.isArray(nested)) {
        return nested.filter((entry): entry is JsonObject => typeof entry === "object" && entry !== null);
      }
    }
  }

  return [];
}

function extractJobsFromToolResult(toolResult: { structuredContent?: unknown; content?: Array<{ type: string; text?: string }>; isError?: boolean }) {
  const fromStructuredContent = extractJobsFromStructuredContent(toolResult.structuredContent);
  if (fromStructuredContent.length > 0) {
    return fromStructuredContent;
  }

  const toolText = extractToolText(toolResult);
  if (!toolText) {
    return [];
  }

  try {
    const parsed = JSON.parse(toolText) as unknown;
    return extractJobsFromStructuredContent(parsed);
  } catch {
    return [];
  }
}

function setFirstMatchingProperty(target: Record<string, unknown>, properties: Record<string, unknown>, candidates: string[], value: unknown) {
  for (const candidate of candidates) {
    if (candidate in properties) {
      target[candidate] = value;
      return;
    }
  }
}

function applyCommonDiceArgs(args: Record<string, unknown>, properties: Record<string, unknown>, preview: ReturnType<typeof buildDiceQueryPreview>) {
  if (preview.workplaceTypes.length > 0) {
    setFirstMatchingProperty(args, properties, ["workplace_types"], preview.workplaceTypes);
  }

  setFirstMatchingProperty(args, properties, ["posted_date"], preview.postedDate);
  setFirstMatchingProperty(args, properties, ["jobs_per_page", "pageSize", "limit", "count"], preview.jobsPerPage);
  setFirstMatchingProperty(args, properties, ["page_number"], 1);
}

function buildDiceAttempts(tool: ToolDefinition, profile: CandidateProfile) {
  const properties = tool.inputSchema?.properties ?? {};
  const preview = buildDiceQueryPreview(profile);

  const attempts: Array<{ label: string; args: Record<string, unknown> }> = [];

  for (const keyword of preview.keywordCandidates) {
    const fullArgs: Record<string, unknown> = {};
    setFirstMatchingProperty(fullArgs, properties, ["keyword", "keywords", "query", "search", "title"], keyword);
    if (preview.location) {
      setFirstMatchingProperty(fullArgs, properties, ["location", "city", "region"], preview.location);
    }
    applyCommonDiceArgs(fullArgs, properties, preview);
    setFirstMatchingProperty(fullArgs, properties, ["fields"], preview.fields);
    attempts.push({ label: `full:${keyword}`, args: fullArgs });

    const noFieldsArgs = { ...fullArgs };
    delete noFieldsArgs.fields;
    attempts.push({ label: `no-fields:${keyword}`, args: noFieldsArgs });

    const keywordOnlyArgs: Record<string, unknown> = {};
    setFirstMatchingProperty(keywordOnlyArgs, properties, ["keyword", "keywords", "query", "search", "title"], keyword);
    applyCommonDiceArgs(keywordOnlyArgs, properties, preview);
    attempts.push({ label: `keyword-only:${keyword}`, args: keywordOnlyArgs });
  }

  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    const serialized = JSON.stringify(attempt.args);
    if (seen.has(serialized)) {
      return false;
    }

    seen.add(serialized);
    return true;
  });
}

function hasContentResult(
  value: unknown
): value is { content?: Array<{ type: string; text?: string }>; structuredContent?: unknown; isError?: boolean } {
  return typeof value === "object" && value !== null && ("content" in value || "structuredContent" in value || "isError" in value);
}

class DiceMcpClient {
  private client?: Client;
  private transport?: StreamableHTTPClientTransport;
  private searchTool?: ToolDefinition;

  async connect() {
    if (this.client) {
      return this.client;
    }

    const transport = new StreamableHTTPClientTransport(new URL(DEFAULT_DICE_MCP_URL));
    const client = new Client({ name: "resume-job-matcher", version: "0.1.0" });

    await client.connect(transport);

    this.client = client;
    this.transport = transport;
    return client;
  }

  async getSearchTool(): Promise<ToolDefinition> {
    if (this.searchTool) {
      return this.searchTool;
    }

    const client = await this.connect();
    const toolsResponse = await client.listTools();
    const tool = toolsResponse.tools.find((entry) => entry.name === "search_jobs");

    if (!tool) {
      throw new Error("Dice MCP did not expose a search_jobs tool.");
    }

    this.searchTool = {
      name: tool.name,
      inputSchema: {
        properties: tool.inputSchema?.properties
      }
    };
    return this.searchTool;
  }

  async search(profile: CandidateProfile): Promise<JobSearchResponse> {
    const client = await this.connect();
    const tool = await this.getSearchTool();
    const attempts = buildDiceAttempts(tool, profile);
    let lastError: unknown;
    const dedupedJobs = new Map<string, JobListing>();

    for (const attempt of attempts) {
      try {
        const result = await client.callTool({ name: tool.name, arguments: attempt.args });

        if (hasContentResult(result) && result.isError) {
          const toolText = extractToolText(result);
          throw new Error(toolText || `Dice MCP returned an error result for ${attempt.label}.`);
        }

        const rawJobs = hasContentResult(result) ? extractJobsFromToolResult(result) : [];
        const jobs = rawJobs
          .map((job, index) => parseDiceJob(job, index))
          .filter((job): job is JobListing => job !== null);

        for (const job of jobs) {
          dedupedJobs.set(job.id, job);
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (dedupedJobs.size > 0) {
      return {
        jobs: Array.from(dedupedJobs.values()),
        meta: {
          provider: "dice",
          fallbackUsed: false,
          notice: AI_DISCLOSURE,
          toolName: tool.name
        }
      };
    }

    if (lastError instanceof Error) {
      throw lastError;
    }

    throw new Error("Dice MCP search completed but returned no usable job listings.");
  }
}

const diceClient = new DiceMcpClient();

export const diceProvider: JobProvider = {
  id: "dice",
  searchJobs: (profile) => diceClient.search(profile)
};
