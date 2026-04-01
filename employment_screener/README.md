# Resume Job Matcher

Single-page responsive MVP for uploading a resume, extracting a candidate profile, ranking matching jobs, and tracking application progress.

## Features

- Upload `PDF` or `DOCX` resumes
- Parse resume text into an editable profile
- Rank jobs with explainable fit scoring
- Filter by keyword, location, freshness, and match score
- Track jobs as saved, applied, interview, or rejected
- Persist profile and tracker state in local browser storage
- Modular job-source adapter layer for future live integrations

## Run

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Notes

- Current job sources are seeded adapters intended for safe MVP development.
- The app is structured so approved public APIs or company-career integrations can be added later in `src/lib/jobSources.ts`.
- Resume parsing is client-side and uses lazy-loaded libraries to keep the initial bundle smaller.
