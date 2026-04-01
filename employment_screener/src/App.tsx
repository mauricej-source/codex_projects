import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  Briefcase,
  CircleHelp,
  FileUp,
  Filter,
  MapPin,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { aggregateJobs } from "./lib/jobSources";
import { filterJobs, scoreJob } from "./lib/matching";
import { defaultProfile, extractResumeText, parseResumeText } from "./lib/resumeParser";
import type { CandidateProfile, JobStatus, ScoredJob, SearchFilters, StoredJobState } from "./types";

const profileStorageKey = "resume-job-matcher.profile";
const trackerStorageKey = "resume-job-matcher.tracker";

const defaultFilters: SearchFilters = {
  keyword: "",
  location: "",
  remoteOnly: false,
  minimumMatch: 35,
  postedWithinDays: 30
};

const statusOptions: JobStatus[] = ["saved", "interested", "applied", "interview", "rejected"];

function App() {
  const [profile, setProfile] = useState<CandidateProfile>(() => {
    const stored = localStorage.getItem(profileStorageKey);
    return stored ? (JSON.parse(stored) as CandidateProfile) : defaultProfile();
  });
  const [jobTracker, setJobTracker] = useState<StoredJobState[]>(() => {
    const stored = localStorage.getItem(trackerStorageKey);
    return stored ? (JSON.parse(stored) as StoredJobState[]) : [];
  });
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  useEffect(() => {
    localStorage.setItem(profileStorageKey, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(trackerStorageKey, JSON.stringify(jobTracker));
  }, [jobTracker]);

  const visibleJobs = useMemo(() => filterJobs(jobs, filters), [jobs, filters]);
  const trackedJobs = useMemo(
    () => jobs.filter((job) => jobTracker.some((entry) => entry.jobId === job.id)),
    [jobTracker, jobs]
  );
  const displayedSkills = useMemo(
    () => Array.from(new Set(profile.skillGroups.flatMap((group) => group.skills))),
    [profile.skillGroups]
  );

  const searchJobs = async (currentProfile: CandidateProfile) => {
    setIsSearching(true);
    setErrorMessage("");

    try {
      const listings = await aggregateJobs(currentProfile);
      const scored = listings.map((job) => scoreJob(job, currentProfile)).sort((a, b) => b.matchScore - a.matchScore);
      setJobs(scored);
      setLastRefresh(new Date().toLocaleString());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to refresh job listings right now."
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleResumeUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Please upload a PDF or DOCX resume.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Please keep your resume under 5 MB.");
      return;
    }

    setIsParsing(true);
    setErrorMessage("");

    try {
      const extracted = await extractResumeText(file);
      const parsed = parseResumeText(extracted.text);
      setProfile(parsed);
      await searchJobs(parsed);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Resume parsing failed. Try a different file."
      );
    } finally {
      setIsParsing(false);
      event.target.value = "";
    }
  };

  const updateTracker = (jobId: string, status: JobStatus) => {
    setJobTracker((current) => {
      const remaining = current.filter((entry) => entry.jobId !== jobId);
      return [...remaining, { jobId, status, notedAt: new Date().toISOString() }];
    });
  };

  const trackerStatusFor = (jobId: string) => jobTracker.find((entry) => entry.jobId === jobId)?.status;

  return (
    <div className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Resume-led opportunity search</p>
          <h1>Employment Screener</h1>
          <p className="hero-text">
            This MVP focuses on permitted and maintainable sourcing. It parses your resume into a
            profile, ranks opportunities against it, and keeps a lightweight tracker in your browser.
          </p>
          <div className="hero-pills">
            <span><ShieldCheck size={16} /> Approved-source minded</span>
            <span><Sparkles size={16} /> Explainable fit scoring</span>
            <span><Briefcase size={16} /> Built for active search</span>
          </div>
        </div>

        <div className="hero-card">
          <div className="stat">
            <span>Resume signal</span>
            <strong>{profile.skills.length} skills detected</strong>
          </div>
          <div className="stat">
            <span>Tracked jobs</span>
            <strong>{jobTracker.length}</strong>
          </div>
          <div className="stat">
            <span>Last refresh</span>
            <strong>{lastRefresh || "Not yet run"}</strong>
          </div>
        </div>
      </section>

      <main className="content-grid">
        <section className="panel upload-panel">
          <div className="panel-heading upload-heading">
            <div className="upload-heading-copy">
              <h2><FileUp size={18} /> Resume Upload</h2>
              <p>PDF or DOCX, up to 5 MB.</p>
            </div>

            <div className="upload-inline-row">
            <label className="upload-dropzone">
              <input type="file" accept=".pdf,.docx" onChange={handleResumeUpload} />
              <span>{isParsing ? "Parsing resume..." : "Choose a file and extract your profile"}</span>
            </label>

            <div className="action-row upload-actions">
              <button
                className="primary-button"
                type="button"
                disabled={isSearching || !profile.rawText}
                onClick={() => searchJobs(profile)}
              >
                <Search size={16} />
                {isSearching ? "Refreshing..." : "Find matching jobs"}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={!profile.rawText}
                onClick={() => {
                  setProfile(defaultProfile());
                  setJobs([]);
                  setJobTracker([]);
                  setFilters(defaultFilters);
                  setLastRefresh("");
                  setErrorMessage("");
                }}
              >
                Reset
              </button>
            </div>
          </div>
          </div>

          {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
        </section>

        <section className="panel profile-panel">
          <div className="panel-heading">
            <div>
              <h2><CircleHelp size={18} /> Parsed Profile</h2>
              <p>Review and refine the extracted signal before searching.</p>
            </div>
          </div>

          <div className="profile-section-grid">
            <div className="profile-fields-grid">
              <label>
                Full Name
                <input value={profile.fullName} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} />
              </label>
              <label>
                Current Title
                <input value={profile.currentTitle} onChange={(event) => setProfile((current) => ({ ...current, currentTitle: event.target.value }))} />
              </label>
              <label>
                Email
                <input value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <label>
                Phone
                <input value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} />
              </label>
              <label>
                Website
                <input value={profile.website} onChange={(event) => setProfile((current) => ({ ...current, website: event.target.value }))} />
              </label>
              <label>
                LinkedIn
                <input value={profile.linkedIn} onChange={(event) => setProfile((current) => ({ ...current, linkedIn: event.target.value }))} />
              </label>
              <label>
                Location
                <input
                  value={profile.location}
                  onChange={(event) => {
                    const value = event.target.value;
                    setProfile((current) => ({
                      ...current,
                      location: value,
                      preferences: {
                        ...current.preferences,
                        preferredLocations: value ? [value] : []
                      }
                    }));
                  }}
                />
              </label>
              <label>
                Work Authorization
                <input value={profile.workAuthorization} onChange={(event) => setProfile((current) => ({ ...current, workAuthorization: event.target.value }))} />
              </label>
              <label>
                Years of Experience
                <input
                  type="number"
                  min={0}
                  value={profile.yearsExperience}
                  onChange={(event) => setProfile((current) => ({ ...current, yearsExperience: Number(event.target.value || 0) }))}
                />
              </label>
              <label className="checkbox checkbox-field">
                <span>Remote Only</span>
                <input
                  type="checkbox"
                  checked={profile.preferences.remoteOnly}
                  onChange={(event) =>
                    setProfile((current) => ({
                      ...current,
                      preferences: { ...current.preferences, remoteOnly: event.target.checked }
                    }))
                  }
                />
              </label>
            </div>

            <label className="summary-panel">
              Summary
              <textarea
                rows={12}
                className="summary-textarea"
                value={profile.summary}
                onChange={(event) => setProfile((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>
          </div>

          <div className="profile-skills-section">
            <label>
              Skills, Comma Seperated
              <textarea
                rows={3}
                value={profile.skills.join(", ")}
                onChange={(event) => {
                  const values = event.target.value.split(",").map((value) => value.trim()).filter(Boolean);
                  setProfile((current) => ({
                    ...current,
                    skills: values,
                    keywords: [...values, ...current.targetTitles].slice(0, 20),
                    skillGroups: values.length ? [{ category: "Manual", skills: values }] : []
                  }));
                }}
              />
            </label>

            {displayedSkills.length ? (
              <div className="skill-groups">
                <div className="skill-group-card">
                  <strong>Skills</strong>
                  <div className="chip-row">
                    {displayedSkills.map((skill) => (
                      <span key={skill} className="chip">{skill}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel filters-panel">
          <div className="panel-heading">
            <div>
              <h2><Filter size={18} /> Search Filters</h2>
              <p>Tighten the list before you spend time reading postings.</p>
            </div>
          </div>

          <div className="filters-inline-row">
            <div className="filter-control filter-keyword">
              <label htmlFor="filter-keyword">Keyword</label>
              <input
                id="filter-keyword"
                value={filters.keyword}
                onChange={(event) => setFilters((current) => ({ ...current, keyword: event.target.value }))}
              />
            </div>
            <div className="filter-control filter-location">
              <label htmlFor="filter-location">Location</label>
              <input
                id="filter-location"
                value={filters.location}
                onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
              />
            </div>
            <div className="filter-control filter-minimum-match">
              <label htmlFor="filter-minimum-match">Minimum match</label>
              <div className="filter-range-control">
                <input
                  id="filter-minimum-match"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={filters.minimumMatch}
                  onChange={(event) => setFilters((current) => ({ ...current, minimumMatch: Number(event.target.value) }))}
                />
                <span className="range-value">{filters.minimumMatch}%</span>
              </div>
            </div>
            <div className="filter-control filter-posted-days">
              <label htmlFor="filter-posted-days">Posted within days</label>
              <input
                id="filter-posted-days"
                type="number"
                min={0}
                value={filters.postedWithinDays}
                onChange={(event) => setFilters((current) => ({ ...current, postedWithinDays: Number(event.target.value || 0) }))}
              />
            </div>
            <div className="filter-control filter-checkbox-field">
              <label htmlFor="filter-remote-only">Remote roles only</label>
              <input
                id="filter-remote-only"
                type="checkbox"
                checked={filters.remoteOnly}
                onChange={(event) => setFilters((current) => ({ ...current, remoteOnly: event.target.checked }))}
              />
            </div>
          </div>
        </section>

        <section className="panel results-panel">
          <div className="panel-heading">
            <div>
              <h2><MapPin size={18} /> Matched Jobs</h2>
              <p>Uses live public job data when available, with seeded fallback results if the source is unavailable.</p>
            </div>
            <div className="panel-actions">
              <span>{visibleJobs.length} jobs visible</span>
              <button className="icon-button" type="button" disabled={isSearching || !profile.rawText} onClick={() => searchJobs(profile)}>
                <RefreshCcw size={16} />
                Refresh
              </button>
            </div>
          </div>

          {!profile.rawText ? <div className="empty-state"><p>Upload a resume to start generating a profile and matched opportunities.</p></div> : null}
          {profile.rawText && visibleJobs.length === 0 && !isSearching ? (
            <div className="empty-state">
              <p>No jobs match the current filters. Lower the minimum score or widen location terms.</p>
            </div>
          ) : null}

          <div className="job-list">
            {visibleJobs.map((job) => (
              <article key={job.id} className="job-card">
                <div className="job-topline">
                  <div>
                    <h3>{job.title}</h3>
                    <p>{job.company} • {job.location}</p>
                  </div>
                  <div className="score-pill">{job.matchScore}% match</div>
                </div>
                <p className="job-meta">{job.workMode} • {job.source} • Posted {job.postedDate}</p>
                <p>{job.description}</p>
                <div className="chip-row">
                  {job.tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}
                </div>
                <div className="insight-box">
                  <strong>Why this matches:</strong> {job.rationale}
                  <br />
                  <strong>Matched skills:</strong> {job.matchedSkills.join(", ") || "None detected yet"}
                  <br />
                  <strong>Potential gaps:</strong> {job.missingSkills.join(", ") || "No obvious gaps"}
                </div>
                <div className="job-actions">
                  <a className="primary-button" href={job.url} target="_blank" rel="noreferrer">
                    View posting
                  </a>
                  <div className="tracker-controls">
                    <Save size={16} />
                    <select value={trackerStatusFor(job.id) ?? ""} onChange={(event) => updateTracker(job.id, event.target.value as JobStatus)}>
                      <option value="" disabled>Track this job</option>
                      {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2><Save size={18} /> Job Tracker</h2>
              <p>Persisted locally in the browser for lightweight follow-up tracking.</p>
            </div>
          </div>

          {trackedJobs.length === 0 ? (
            <div className="empty-state">
              <p>Mark jobs as saved, applied, or interview to start tracking them here.</p>
            </div>
          ) : (
            <div className="tracker-list">
              {trackedJobs.map((job) => (
                <div key={job.id} className="tracker-item">
                  <div>
                    <strong>{job.title}</strong>
                    <p>{job.company}</p>
                  </div>
                  <span className="status-pill">{trackerStatusFor(job.id)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
