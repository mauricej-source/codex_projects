import { mockJobs } from "../../src/data/mockJobs.js";
import type { CandidateProfile, JobListing, JobSearchResponse } from "../../src/types.js";

const scoreRelevance = (job: JobListing, profile: CandidateProfile) => {
  const haystack = `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();

  return profile.keywords.reduce((score, keyword) => {
    return score + (haystack.includes(keyword.toLowerCase()) ? 1 : 0);
  }, 0);
};

export async function searchFallbackJobs(
  profile: CandidateProfile,
  warning?: string
): Promise<JobSearchResponse> {
  const preferredLocations = profile.preferences.preferredLocations.map((location) =>
    location.toLowerCase()
  );

  const jobs = [...mockJobs]
    .filter((job) => {
      if (profile.preferences.remoteOnly && job.workMode !== "Remote") {
        return false;
      }

      if (preferredLocations.length === 0) {
        return true;
      }

      if (profile.preferences.remoteOnly && job.workMode === "Remote") {
        return true;
      }

      return preferredLocations.some((location) => job.location.toLowerCase().includes(location));
    })
    .sort((left, right) => scoreRelevance(right, profile) - scoreRelevance(left, profile));

  return {
    jobs,
    meta: {
      provider: "mock-fallback",
      fallbackUsed: true,
      warning
    }
  };
}
