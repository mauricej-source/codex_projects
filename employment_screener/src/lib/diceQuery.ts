import type { CandidateProfile } from "../types.js";

export const DICE_DEFAULT_KEYWORD_FALLBACK = "Software Engineer";

export type DiceQueryPreview = {
  keywordCandidates: string[];
  location: string;
  workplaceTypes: string[];
  postedDate: "SEVEN";
  jobsPerPage: number;
  fields: string[];
};

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function dedupeStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => normalizeWhitespace(value))
        .filter(Boolean)
    )
  );
}

export function sanitizeKeyword(value: string) {
  return normalizeWhitespace(value)
    .replace(/[^\w\s+.#/&()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function simplifyLocation(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";

  const cityStateMatch = normalized.match(/[A-Za-z .'-]+,\s*[A-Z]{2}\b/);
  if (cityStateMatch) {
    return cityStateMatch[0];
  }

  const cityStateCountryMatch = normalized.match(/[A-Za-z .'-]+,\s*[A-Za-z .'-]+,\s*[A-Za-z .'-]+/);
  if (cityStateCountryMatch) {
    return cityStateCountryMatch[0];
  }

  return normalized.split("|")[0]?.split(";")[0]?.trim() ?? normalized;
}

export function buildKeywordCandidates(profile: CandidateProfile) {
  const fullSignal = dedupeStrings([...profile.targetTitles, ...profile.skills, ...profile.keywords]);

  const conciseSignal = dedupeStrings([
    profile.currentTitle,
    ...profile.targetTitles.slice(0, 2),
    ...profile.skills.slice(0, 3)
  ]);

  const broadSignal = dedupeStrings([
    profile.currentTitle,
    profile.targetTitles[0],
    profile.skills[0],
    profile.skills[1]
  ]);

  return [
    sanitizeKeyword(fullSignal.slice(0, 6).join(" ")),
    sanitizeKeyword(conciseSignal.slice(0, 4).join(" ")),
    sanitizeKeyword(broadSignal.slice(0, 2).join(" ")),
    sanitizeKeyword(profile.currentTitle),
    sanitizeKeyword(profile.targetTitles[0] ?? ""),
    DICE_DEFAULT_KEYWORD_FALLBACK
  ].filter(Boolean);
}

export function buildDiceQueryPreview(profile: CandidateProfile): DiceQueryPreview {
  return {
    keywordCandidates: buildKeywordCandidates(profile),
    location: simplifyLocation(profile.preferences.preferredLocations[0] || profile.location),
    workplaceTypes: profile.preferences.remoteOnly ? ["Remote"] : [],
    postedDate: "SEVEN",
    jobsPerPage: 25,
    fields: [
      "id",
      "title",
      "summary",
      "postedDate",
      "jobLocation.displayName",
      "detailsPageUrl",
      "salary",
      "companyPageUrl",
      "companyName",
      "employmentType",
      "workplaceTypes",
      "isRemote",
      "willingToSponsor"
    ]
  };
}
