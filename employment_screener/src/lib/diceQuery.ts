import type { CandidateProfile } from "../types.js";

export const DICE_DEFAULT_KEYWORD_FALLBACK = "Software Engineer";

export type DiceQueryPreview = {
  keywordCandidates: string[];
  primaryKeyword: string;
  location: string;
  workplaceTypes: string[];
  postedDate: string;
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
  const titleQueries = dedupeStrings([profile.currentTitle, ...profile.targetTitles]).map(
    sanitizeKeyword
  );

  const keywordQueries = dedupeStrings([
    ...profile.keywords.slice(0, 4),
    profile.currentTitle,
    profile.targetTitles[0]
  ]).map(sanitizeKeyword);

  return [...titleQueries, ...keywordQueries, DICE_DEFAULT_KEYWORD_FALLBACK].filter(Boolean);
}

function toDiceWorkplaceType(value: string) {
  if (value === "On-site") {
    return "On-Site";
  }

  return value;
}

export function buildDiceQueryPreview(profile: CandidateProfile): DiceQueryPreview {
  const keywordCandidates = buildKeywordCandidates(profile);

  return {
    keywordCandidates,
    primaryKeyword: keywordCandidates[0] ?? DICE_DEFAULT_KEYWORD_FALLBACK,
    location: simplifyLocation(profile.diceSearch.location),
    workplaceTypes: profile.diceSearch.workplaceTypes.map(toDiceWorkplaceType),
    postedDate: normalizeWhitespace(profile.diceSearch.postedDate) || "SEVEN",
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
