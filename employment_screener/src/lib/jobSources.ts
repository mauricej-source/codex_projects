import { mockJobs } from "../data/mockJobs";
import type { CandidateProfile, JobListing } from "../types";

export type JobSourceAdapter = {
  id: string;
  label: string;
  fetchJobs: (profile: CandidateProfile) => Promise<JobListing[]>;
};

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RemotiveJob = {
  id: number;
  title: string;
  company_name: string;
  candidate_required_location?: string;
  category?: string;
  job_type?: string;
  publication_date?: string;
  salary?: string;
  url: string;
  description?: string;
  tags?: string[];
};

const scoreRelevance = (job: JobListing, profile: CandidateProfile) => {
  const haystack = `${job.title} ${job.description} ${job.tags.join(" ")}`.toLowerCase();
  return profile.keywords.reduce(
    (total, keyword) => total + (haystack.includes(keyword.toLowerCase()) ? 1 : 0),
    0
  );
};

const curatedFeedAdapter: JobSourceAdapter = {
  id: "curated-demo",
  label: "Curated demo feed",
  fetchJobs: async (profile) => {
    await pause(250);
    return [...mockJobs]
      .sort((a, b) => scoreRelevance(b, profile) - scoreRelevance(a, profile))
      .slice(0, 12);
  }
};

const remotiveAdapter: JobSourceAdapter = {
  id: "remotive-live",
  label: "Remotive public API",
  fetchJobs: async (profile) => {
    const query = encodeURIComponent(
      [...profile.targetTitles, ...profile.skills, ...profile.keywords]
        .filter(Boolean)
        .slice(0, 4)
        .join(" ")
    );

    const response = await fetch(`https://remotive.com/api/remote-jobs?search=${query}`);
    if (!response.ok) {
      throw new Error(`Remotive request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as { jobs?: RemotiveJob[] };
    const jobs = payload.jobs ?? [];

    return jobs.slice(0, 30).map((job) => ({
      id: `remotive-${job.id}`,
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location || "Remote",
      workMode: "Remote",
      description: (job.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      source: "Remotive",
      url: job.url,
      postedDate: (job.publication_date ?? "").slice(0, 10),
      salary: job.salary || undefined,
      tags: [
        ...(job.tags ?? []),
        ...(job.category ? [job.category] : []),
        ...(job.job_type ? [job.job_type] : [])
      ].filter(Boolean)
    }));
  }
};

const seededFallbackAdapter: JobSourceAdapter = {
  id: "seeded-fallback",
  label: "Seeded fallback feed",
  fetchJobs: async (profile) => {
    await pause(200);

    const preferredLocations = profile.preferences.preferredLocations.map((location) =>
      location.toLowerCase()
    );

    return mockJobs.filter((job) => {
      if (profile.preferences.remoteOnly && job.workMode !== "Remote") {
        return false;
      }

      if (preferredLocations.length === 0) {
        return true;
      }

      return preferredLocations.some((location) => job.location.toLowerCase().includes(location));
    });
  }
};

export const jobSourceAdapters: JobSourceAdapter[] = [remotiveAdapter];

export async function aggregateJobs(profile: CandidateProfile) {
  const liveResults = await Promise.allSettled(jobSourceAdapters.map((adapter) => adapter.fetchJobs(profile)));
  const deduped = new Map<string, JobListing>();
  const successfulLiveJobs = liveResults
    .filter((result): result is PromiseFulfilledResult<JobListing[]> => result.status === "fulfilled")
    .flatMap((result) => result.value);

  const jobsToUse = successfulLiveJobs.length > 0 ? successfulLiveJobs : await seededFallbackAdapter.fetchJobs(profile);

  jobsToUse.forEach((job) => {
    deduped.set(job.id, job);
  });

  return Array.from(deduped.values());
}
