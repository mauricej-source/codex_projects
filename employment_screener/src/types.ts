export type WorkMode = "Remote" | "Hybrid" | "On-site";

export type CandidateProfile = {
  fullName: string;
  currentTitle: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  linkedIn: string;
  workAuthorization: string;
  summary: string;
  yearsExperience: number;
  targetTitles: string[];
  skills: string[];
  workHistory: string[];
  education: string[];
  certifications: string[];
  keywords: string[];
  skillGroups: SkillGroup[];
  sections: ResumeSection[];
  preferences: {
    remoteOnly: boolean;
    preferredLocations: string[];
    minimumSalary?: number;
  };
  rawText: string;
};

export type SkillGroup = {
  category: string;
  skills: string[];
};

export type ResumeSection = {
  heading: string;
  lines: string[];
};

export type JobListing = {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: WorkMode;
  description: string;
  source: string;
  url: string;
  postedDate: string;
  salary?: string;
  tags: string[];
};

export type ScoredJob = JobListing & {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  rationale: string;
};

export type JobStatus = "saved" | "interested" | "applied" | "interview" | "rejected";

export type StoredJobState = {
  jobId: string;
  status: JobStatus;
  notedAt: string;
};

export type SearchFilters = {
  keyword: string;
  location: string;
  remoteOnly: boolean;
  minimumMatch: number;
  postedWithinDays: number;
};

export type JobSearchProvider = "dice" | "mock-fallback";

export type JobSearchMeta = {
  provider: JobSearchProvider;
  fallbackUsed: boolean;
  warning?: string;
  notice?: string;
  toolName?: string;
};

export type JobSearchResponse = {
  jobs: JobListing[];
  meta: JobSearchMeta;
};
