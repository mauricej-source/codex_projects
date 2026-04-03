import type { CandidateProfile, JobSearchResponse } from "../../src/types.js";

export type JobProvider = {
  id: "dice";
  searchJobs: (profile: CandidateProfile) => Promise<JobSearchResponse>;
};
