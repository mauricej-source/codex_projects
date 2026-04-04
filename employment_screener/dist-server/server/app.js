import cors from "cors";
import express from "express";
import { searchJobsForProfile } from "./searchService.js";
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
});
app.post("/api/jobs/search", async (request, response) => {
    const profile = request.body?.profile;
    if (!profile || typeof profile !== "object" || !Array.isArray(profile.skills)) {
        response.status(400).json({ message: "A valid candidate profile is required." });
        return;
    }
    try {
        const result = await searchJobsForProfile(profile);
        response.json(result);
    }
    catch (error) {
        response.status(502).json({
            message: error instanceof Error ? error.message : "The job search backend failed to complete the request."
        });
    }
});
export default app;
