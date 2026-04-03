export const DICE_DEFAULT_KEYWORD_FALLBACK = "Software Engineer";
export function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
}
export function dedupeStrings(values) {
    return Array.from(new Set(values
        .filter((value) => typeof value === "string")
        .map((value) => normalizeWhitespace(value))
        .filter(Boolean)));
}
export function sanitizeKeyword(value) {
    return normalizeWhitespace(value)
        .replace(/[^\w\s+.#/&()-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
export function simplifyLocation(value) {
    const normalized = normalizeWhitespace(value);
    if (!normalized)
        return "";
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
export function buildKeywordCandidates(profile) {
    const titleQueries = dedupeStrings([profile.currentTitle, ...profile.targetTitles]).map(sanitizeKeyword);
    const keywordQueries = dedupeStrings([
        ...profile.keywords.slice(0, 4),
        profile.currentTitle,
        profile.targetTitles[0]
    ]).map(sanitizeKeyword);
    return [...titleQueries, ...keywordQueries, DICE_DEFAULT_KEYWORD_FALLBACK].filter(Boolean);
}
function toDiceWorkplaceType(value) {
    if (value === "On-site") {
        return "On-Site";
    }
    return value;
}
export function buildDiceQueryPreview(profile) {
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
