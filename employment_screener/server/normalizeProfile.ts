import type { CandidateProfile, WorkMode } from "../src/types.js";

const defaultWorkplaceTypes: WorkMode[] = ["Remote", "Hybrid", "On-site"];

export function normalizeCandidateProfile(input: Partial<CandidateProfile>): CandidateProfile {
  const targetTitles = Array.isArray(input.targetTitles) ? input.targetTitles.filter(Boolean) : [];
  const skills = Array.isArray(input.skills) ? input.skills.filter(Boolean) : [];

  return {
    fullName: input.fullName ?? "",
    currentTitle: input.currentTitle ?? "",
    email: input.email ?? "",
    phone: input.phone ?? "",
    location: input.location ?? "",
    website: input.website ?? "",
    linkedIn: input.linkedIn ?? "",
    workAuthorization: input.workAuthorization ?? "",
    summary: input.summary ?? "",
    yearsExperience: typeof input.yearsExperience === "number" ? input.yearsExperience : 0,
    targetTitles,
    skills,
    workHistory: Array.isArray(input.workHistory) ? input.workHistory.filter(Boolean) : [],
    education: Array.isArray(input.education) ? input.education.filter(Boolean) : [],
    certifications: Array.isArray(input.certifications) ? input.certifications.filter(Boolean) : [],
    keywords: Array.isArray(input.keywords)
      ? input.keywords.filter(Boolean)
      : Array.from(new Set([...targetTitles, ...skills])).slice(0, 20),
    skillGroups: Array.isArray(input.skillGroups) ? input.skillGroups : [],
    sections: Array.isArray(input.sections) ? input.sections : [],
    preferences: {
      remoteOnly: Boolean(input.preferences?.remoteOnly),
      preferredLocations: Array.isArray(input.preferences?.preferredLocations)
        ? input.preferences.preferredLocations.filter(Boolean)
        : input.location
          ? [input.location]
          : [],
      minimumSalary:
        typeof input.preferences?.minimumSalary === "number" ? input.preferences.minimumSalary : undefined
    },
    diceSearch: {
      location: input.diceSearch?.location ?? input.location ?? "",
      workplaceTypes:
        Array.isArray(input.diceSearch?.workplaceTypes) && input.diceSearch.workplaceTypes.length > 0
          ? input.diceSearch.workplaceTypes
          : defaultWorkplaceTypes,
      postedDate: input.diceSearch?.postedDate ?? "SEVEN"
    },
    rawText: input.rawText ?? ""
  };
}
