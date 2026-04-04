import type { IncomingMessage, ServerResponse } from "node:http";
import { normalizeCandidateProfile } from "../../server/normalizeProfile.js";
import { searchJobsForProfile } from "../../server/searchService.js";
import type { CandidateProfile } from "../../src/types.js";

type JsonBody = {
  profile?: CandidateProfile;
};

async function readJsonBody(request: IncomingMessage): Promise<JsonBody | null> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as JsonBody;
  } catch {
    return null;
  }
}

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  if (request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ message: "Method not allowed." }));
    return;
  }

  const body = await readJsonBody(request);
  const profileInput = body?.profile;

  if (!profileInput || typeof profileInput !== "object") {
    response.statusCode = 400;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ message: "A valid candidate profile is required." }));
    return;
  }

  try {
    const profile = normalizeCandidateProfile(profileInput);
    const result = await searchJobsForProfile(profile);
    response.statusCode = 200;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(result));
  } catch (error) {
    response.statusCode = 502;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        message:
          error instanceof Error ? error.message : "The job search backend failed to complete the request."
      })
    );
  }
}
