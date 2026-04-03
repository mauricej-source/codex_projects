import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  Briefcase,
  CircleHelp,
  FileUp,
  Filter,
  MapPin,
  Save,
  Search,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { searchJobs as searchJobsRequest } from "./lib/jobSearchApi";
import { filterJobs, scoreJob } from "./lib/matching";
import { defaultProfile, extractResumeText, parseResumeText } from "./lib/resumeParser";
import type {
  CandidateProfile,
  JobSearchMeta,
  JobStatus,
  WorkMode,
  ScoredJob,
  SearchFilters,
  StoredJobState
} from "./types";

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
const workplaceOptions: WorkMode[] = ["Remote", "Hybrid", "On-site"];
const defaultTargetTitles = [
  "Cloud Engineer",
  "Platform Engineer",
  "Site Reliability Engineer",
  "Java Developer",
  "Backend Engineer",
  "Backend Software Engineer",
  "Java Engineer",
  "Lead Java Developer",
  "Java Backend Developer"
];
const postedDateOptions = [
  { value: "ONE", label: "Last 1 day" },
  { value: "THREE", label: "Last 3 days" },
  { value: "SEVEN", label: "Last 7 days" },
  { value: "THIRTY", label: "Last 30 days" }
] as const;

function App() {
  const emptyProfile = defaultProfile();
  const initialProfile: CandidateProfile = {
    ...emptyProfile,
    targetTitles: defaultTargetTitles
  };
  const [profile, setProfile] = useState<CandidateProfile>(() => {
    const stored = localStorage.getItem(profileStorageKey);
    return stored
      ? {
          ...emptyProfile,
          ...(JSON.parse(stored) as CandidateProfile),
          targetTitles: defaultTargetTitles,
          keywords: [],
          diceSearch: {
            ...emptyProfile.diceSearch,
            ...((JSON.parse(stored) as CandidateProfile).diceSearch ?? {})
          }
        }
      : initialProfile;
  });
  const [targetTitlesInput, setTargetTitlesInput] = useState(defaultTargetTitles.join(", "));
  const [parsedResumeDefaults, setParsedResumeDefaults] = useState<Pick<
    CandidateProfile,
    "skills"
  > | null>(null);
  const [jobTracker, setJobTracker] = useState<StoredJobState[]>(() => {
    const stored = localStorage.getItem(trackerStorageKey);
    return stored ? (JSON.parse(stored) as StoredJobState[]) : [];
  });
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [jobs, setJobs] = useState<ScoredJob[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isProfileCollapsed, setIsProfileCollapsed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");
  const [searchMeta, setSearchMeta] = useState<JobSearchMeta | null>(null);

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
  const availableSkillOptions = useMemo(
    () =>
      Array.from(
        new Set([...(parsedResumeDefaults?.skills ?? []), ...displayedSkills, ...profile.skills])
      ).sort((left, right) => left.localeCompare(right)),
    [displayedSkills, parsedResumeDefaults, profile.skills]
  );
  const applyRemoteOnly = (checked: boolean) => {
    setFilters((current) => ({ ...current, remoteOnly: checked }));
    setProfile((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        remoteOnly: checked
      },
      diceSearch: {
        ...current.diceSearch,
        workplaceTypes: checked
          ? ["Remote"]
          : current.diceSearch.workplaceTypes.filter((value) => value !== "Remote")
      }
    }));
  };

  const searchJobs = async (currentProfile: CandidateProfile) => {
    setIsSearching(true);
    setErrorMessage("");

    try {
      const { jobs: listings, meta } = await searchJobsRequest(currentProfile);
      const scored = listings.map((job) => scoreJob(job, currentProfile)).sort((a, b) => b.matchScore - a.matchScore);
      setJobs(scored);
      setSearchMeta(meta);
      setErrorMessage(meta.warning ?? "");
      setLastRefresh(new Date().toLocaleString());
    } catch (error) {
      setSearchMeta(null);
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
      setParsedResumeDefaults({
        skills: parsed.skills
      });

      const nextProfile: CandidateProfile = {
        ...parsed,
        currentTitle: parsed.currentTitle,
        targetTitles: defaultTargetTitles,
        skills: [],
        keywords: [],
        diceSearch: {
          ...emptyProfile.diceSearch
        }
      };

      setProfile(nextProfile);
      setTargetTitlesInput(defaultTargetTitles.join(", "));
      setJobs([]);
      setSearchMeta(null);
      setLastRefresh("");
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
  const resetPage = () => {
    localStorage.removeItem(profileStorageKey);
    localStorage.removeItem(trackerStorageKey);
    setProfile(initialProfile);
    setTargetTitlesInput(defaultTargetTitles.join(", "));
    setParsedResumeDefaults(null);
    setJobTracker([]);
    setJobs([]);
    setFilters(defaultFilters);
    setLastRefresh("");
    setSearchMeta(null);
    setErrorMessage("");
  };

  return (
    <div className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Resume-led opportunity search</p>
          <h1>Employment Portal Screener</h1>
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
        </div>
      </section>

      <main className={`content-grid${isProfileCollapsed ? " profile-collapsed" : ""}`}>
        <div className="side-column left-column">
          <section className="panel upload-panel">
            <div className="panel-heading upload-heading">
              <div className="upload-heading-copy">
                <div className="upload-title-row">
                  <h2><FileUp size={18} /> Resume Upload</h2>
                  <p className="inline-helper-text">PDF or DOCX, up to 5 MB.</p>
                </div>
              </div>
            </div>

            <div className="upload-inline-row">
              <label className="upload-dropzone">
                <input type="file" accept=".pdf,.docx" onChange={handleResumeUpload} />
                <span>{isParsing ? "Parsing resume..." : "Choose a file and extract your profile"}</span>
              </label>

              <button
                className="secondary-button upload-reset-button"
                type="button"
                disabled={!profile.rawText}
                onClick={resetPage}
              >
                Reset
              </button>
            </div>

            {errorMessage ? <p className="error-banner">{errorMessage}</p> : null}
          </section>

          <section className="panel filters-panel">
            <button
              className="primary-button full-width-button"
              type="button"
              disabled={isSearching || !profile.rawText}
              onClick={() => searchJobs(profile)}
            >
              <Search size={16} />
              {isSearching ? "Querying..." : "Query"}
            </button>

            <div className="section-divider" />

            <div className="panel-heading">
              <div>
                <h2><Filter size={18} /> Search Filters</h2>
                <p>Tighten the list before you spend time reading postings.</p>
              </div>
            </div>

            <div className="filters-inline-row">
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
              <div className="filter-control filter-checkbox-field">
                <label htmlFor="filter-remote-only">Remote roles only</label>
                <input
                  id="filter-remote-only"
                  type="checkbox"
                  checked={filters.remoteOnly}
                  onChange={(event) => applyRemoteOnly(event.target.checked)}
                />
              </div>
            </div>

            <div className="dice-input-panel">
              <div className="panel-heading dice-preview-heading">
                <div>
                  <h2><Search size={18} /> Dice Job Portal - Search Criteria</h2>
                </div>
              </div>

              <div className="dice-input-grid">
                <label>
                  Current Title:
                  <input
                    value={profile.currentTitle}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, currentTitle: event.target.value }))
                    }
                  />
                </label>

                <label>
                  Target Titles:
                  <input
                    placeholder="Enter target titles separated by commas"
                    value={targetTitlesInput}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setTargetTitlesInput(nextValue);
                      setProfile((current) => ({
                        ...current,
                        targetTitles: nextValue
                          .split(",")
                          .map((value) => value.trim())
                          .filter(Boolean)
                      }));
                    }}
                  />
                </label>

                <label>
                  Location:
                  <input
                    value={profile.diceSearch.location}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        diceSearch: {
                          ...current.diceSearch,
                          location: event.target.value
                        }
                      }))
                    }
                  />
                </label>

                <label>
                  Workplace:
                  <select
                    className="compact-multiselect"
                    multiple
                    size={workplaceOptions.length}
                    value={profile.diceSearch.workplaceTypes}
                    onChange={(event) => {
                      const nextWorkplaceTypes = Array.from(event.target.selectedOptions).map(
                        (option) => option.value as WorkMode
                      );
                      const remoteOnly = nextWorkplaceTypes.length === 1 && nextWorkplaceTypes[0] === "Remote";
                      setProfile((current) => ({
                        ...current,
                        preferences: {
                          ...current.preferences,
                          remoteOnly
                        },
                        diceSearch: {
                          ...current.diceSearch,
                          workplaceTypes: nextWorkplaceTypes
                        }
                      }));
                      setFilters((current) => ({ ...current, remoteOnly }));
                    }}
                  >
                    {workplaceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Posted date:
                  <select
                    value={profile.diceSearch.postedDate}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        diceSearch: {
                          ...current.diceSearch,
                          postedDate: event.target.value
                        }
                      }))
                    }
                  >
                    {postedDateOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Skills:
                  <select
                    multiple
                    size={Math.min(Math.max(availableSkillOptions.length, 6), 12)}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        skills: Array.from(event.target.selectedOptions).map((option) => option.value)
                      }))
                    }
                    value={profile.skills}
                  >
                    {availableSkillOptions.map((skill) => (
                      <option key={skill} value={skill}>
                        {skill}
                      </option>
                    ))}
                  </select>
                </label>

                {parsedResumeDefaults?.skills.length ? (
                  <div className="inline-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        setProfile((current) => ({
                          ...current,
                          skills: parsedResumeDefaults.skills
                        }))
                      }
                    >
                      Use Parsed Resume Skills
                    </button>
                  </div>
                ) : null}

                <label>
                  Keywords:
                  <textarea
                    rows={3}
                    placeholder="Enter one keyword per line"
                    value={profile.keywords.join("\n")}
                    onChange={(event) =>
                      setProfile((current) => ({
                        ...current,
                        keywords: event.target.value
                          .split("\n")
                          .map((value) => value.trim())
                          .filter(Boolean)
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          </section>

        </div>

        <div className="main-column">
          <section className={`panel profile-panel${isProfileCollapsed ? " is-collapsed" : ""}`}>
            <div className="panel-heading">
              <div>
                <div className="upload-title-row">
                  <h2><CircleHelp size={18} /> Parsed Resume Profile</h2>
                  <p className="inline-helper-text">Review and refine the extracted signal before searching.</p>
                </div>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => setIsProfileCollapsed((current) => !current)}
                aria-expanded={!isProfileCollapsed}
                aria-controls="parsed-resume-profile-body"
              >
                {isProfileCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                {isProfileCollapsed ? "Expand" : "Collapse"}
              </button>
            </div>

            {!isProfileCollapsed ? (
              <div id="parsed-resume-profile-body" className="profile-panel-body">
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
                  </div>

                  <div className="profile-side-column">
                    <div className="profile-fields-grid">
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
                  </div>
                </div>

                <label className="summary-panel">
                  Summary
                  <textarea
                    rows={6}
                    className="summary-textarea"
                    value={profile.summary}
                    onChange={(event) => setProfile((current) => ({ ...current, summary: event.target.value }))}
                  />
                </label>

                <div className="profile-skills-section">
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
              </div>
            ) : null}
          </section>

          <section className="panel results-panel">
            <div className="panel-heading">
              <div>
                <h2><MapPin size={18} /> Matched Jobs</h2>
              <p>
                {searchMeta?.provider === "dice"
                  ? "Results are coming from the Dice MCP-backed provider."
                  : "The backend targets Dice first and falls back to seeded jobs if the provider is unavailable."}
              </p>
            </div>
            <div className="panel-actions">
              <span>{visibleJobs.length} jobs visible</span>
            </div>
          </div>

          {searchMeta ? (
            <p className="job-source-note">
              Source: {searchMeta.provider === "dice" ? "Dice" : "Seeded fallback"}
              {searchMeta.notice ? ` • ${searchMeta.notice}` : ""}
            </p>
          ) : null}

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

        </div>

      </main>
    </div>
  );
}

export default App;
