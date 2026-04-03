import type { CandidateProfile, JobListing, ScoredJob, SearchFilters } from "../types";
import { scanKnownSkills } from "./resumeParser";

const normalize = (value: string) => value.toLowerCase();
const unique = (values: string[]) => Array.from(new Set(values));
const excludedNonSkillTerms = new Set(["remote", "hybrid", "on-site", "onsite"]);

const daysSince = (dateText: string) => {
  const date = new Date(dateText);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
};

export function scoreJob(job: JobListing, profile: CandidateProfile): ScoredJob {
  const jobText = normalize(`${job.title} ${job.description} ${job.tags.join(" ")}`);
  const parsedResumeSkills = unique(
    profile.skillGroups.flatMap((group) => group.skills).filter(Boolean)
  );
  const scoringSkills = parsedResumeSkills.length > 0 ? parsedResumeSkills : profile.skills;
  const jobDescriptionSkills = scanKnownSkills(`${job.title}\n${job.description}`).filter(
    (skill) => !excludedNonSkillTerms.has(normalize(skill))
  );
  const matchedSkills = jobDescriptionSkills.filter((skill) =>
    scoringSkills.some((resumeSkill) => normalize(resumeSkill) === normalize(skill))
  );
  const missingSkills = jobDescriptionSkills.filter(
    (skill) => !scoringSkills.some((resumeSkill) => normalize(resumeSkill) === normalize(skill))
  );
  const titleSignals = [profile.currentTitle, ...profile.targetTitles].filter(Boolean);
  const searchLocation = profile.diceSearch.location.trim();

  let score = 35;
  score += Math.min(matchedSkills.length * 8, 32);

  if (titleSignals.some((title) => job.title.toLowerCase().includes(title.toLowerCase()))) {
    score += 15;
  }

  if (profile.preferences.remoteOnly && job.workMode === "Remote") {
    score += 8;
  }

  if (searchLocation && job.location.toLowerCase().includes(searchLocation.toLowerCase())) {
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
    titleSignals.length
      ? `aligned with title targets like ${titleSignals.slice(0, 2).join(" / ")}`
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
