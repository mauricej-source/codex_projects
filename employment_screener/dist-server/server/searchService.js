import { diceProvider } from "./providers/diceProvider.js";
import { searchFallbackJobs } from "./providers/fallbackProvider.js";
export async function searchJobsForProfile(profile) {
    try {
        return await diceProvider.searchJobs(profile);
    }
    catch (error) {
        const warning = error instanceof Error
            ? `Dice search is unavailable right now. Showing fallback jobs instead. ${error.message}`
            : "Dice search is unavailable right now. Showing fallback jobs instead.";
        return searchFallbackJobs(profile, warning);
    }
}
