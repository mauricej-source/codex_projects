import type { CandidateProfile, JobSearchResponse } from "../types";

export async function searchJobs(profile: CandidateProfile): Promise<JobSearchResponse> {
  const response = await fetch("/api/jobs/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ profile })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || `Job search request failed with status ${response.status}`);
  }

  return (await response.json()) as JobSearchResponse;
}
