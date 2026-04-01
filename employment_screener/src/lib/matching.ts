import type { CandidateProfile, JobListing, ScoredJob, SearchFilters } from "../types";

const normalize = (value: string) => value.toLowerCase();

const daysSince = (dateText: string) => {
  const date = new Date(dateText);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

export function scoreJob(job: JobListing, profile: CandidateProfile): ScoredJob {
  const jobText = normalize(`${job.title} ${job.description} ${job.tags.join(" ")}`);
  const matchedSkills = profile.skills.filter((skill) => jobText.includes(normalize(skill)));
  const missingSkills = job.tags.filter(
    (tag) => !profile.skills.some((skill) => normalize(skill) === normalize(tag))
  );

  let score = 35;
  score += Math.min(matchedSkills.length * 8, 32);

  if (profile.targetTitles.some((title) => job.title.toLowerCase().includes(title.toLowerCase()))) {
    score += 15;
  }

  if (profile.preferences.remoteOnly && job.workMode === "Remote") {
    score += 8;
  }

  if (
    profile.preferences.preferredLocations.some((location) =>
      job.location.toLowerCase().includes(location.toLowerCase())
    )
  ) {
    score += 10;
  }

  if (profile.yearsExperience >= 5) {
    score += 5;
  }

  score = Math.min(score, 99);

  const rationaleParts = [
    matchedSkills.length
      ? `Strong overlap in ${matchedSkills.slice(0, 4).join(", ")}`
      : "Limited skill overlap so far",
    profile.targetTitles.length
      ? `targeting roles like ${profile.targetTitles.slice(0, 2).join(" / ")}`
      : "title preferences still broad",
    job.workMode === "Remote" ? "offers remote flexibility" : `is ${job.workMode.toLowerCase()}`
  ];

  return {
    ...job,
    matchScore: score,
    matchedSkills,
    missingSkills: missingSkills.slice(0, 4),
    rationale: `${rationaleParts.join(", ")}.`
  };
}

export function filterJobs(jobs: ScoredJob[], filters: SearchFilters) {
  return jobs.filter((job) => {
    const keywordMatch =
      !filters.keyword ||
      `${job.title} ${job.company} ${job.description} ${job.tags.join(" ")}`
        .toLowerCase()
        .includes(filters.keyword.toLowerCase());
    const locationMatch =
      !filters.location || job.location.toLowerCase().includes(filters.location.toLowerCase());
    const remoteMatch = !filters.remoteOnly || job.workMode === "Remote";
    const scoreMatch = job.matchScore >= filters.minimumMatch;
    const dateMatch =
      filters.postedWithinDays <= 0 || daysSince(job.postedDate) <= filters.postedWithinDays;

    return keywordMatch && locationMatch && remoteMatch && scoreMatch && dateMatch;
  });
}
