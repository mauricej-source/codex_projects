# Resume Job Matcher

Single-page responsive MVP for uploading a resume, extracting a candidate profile, ranking matching jobs, and tracking application progress.

## Features

- Upload `PDF` or `DOCX` resumes
- Parse resume text into an editable profile
- Rank jobs with explainable fit scoring
- Filter by keyword, location, freshness, and match score
- Track jobs as saved, applied, interview, or rejected
- Persist profile and tracker state in local browser storage
- Backend-owned provider layer with Dice MCP integration and seeded fallback

## Run

```bash
npm install
npm run dev
```

This now starts:
- the Vite frontend on `http://localhost:4321`
- the backend API on `http://localhost:8787`

Production build:

```bash
npm run build
```

## Notes

- Live job search now runs through a backend API that targets Dice's MCP job-search tool.
- If Dice is unavailable or returns an unusable response, the backend falls back to seeded jobs so the UI still works.
- Resume parsing is client-side and uses lazy-loaded libraries to keep the initial bundle smaller.
