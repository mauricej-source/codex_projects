import { BrainCircuit, FileSearch2, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AssessmentGenerator } from './components/AssessmentGenerator';
import { JobDescriptionUploader } from './components/JobDescriptionUploader';
import { PanelToggle } from './components/PanelToggle';
import { ParsedKeywordsPanel } from './components/ParsedKeywordsPanel';
import { ResultsSummary } from './components/ResultsSummary';
import { TechnologySelector } from './components/TechnologySelector';
import { groupKeywordsByCategory, extractTechnicalKeywords, parseUploadedFile } from './utils/jobDescriptionParser';
import {
  calculateResults,
  generateAssessmentQuestions,
} from './utils/questionGenerator';
import {
  QUESTION_SOURCE_LABEL,
  QUESTION_SOURCE_PATH,
} from './services/assessmentQuestionService';
import { clearPersistedState, loadPersistedState, savePersistedState } from './utils/storage';
import type { Difficulty, PersistedState, Question } from './types';

const SAMPLE_JOB_DESCRIPTION = `Senior Full Stack Engineer

We are looking for an engineer with strong experience in JavaScript, TypeScript, React, Node.js, REST APIs, SQL, AWS, Docker, Kubernetes, Git, CI/CD, and system design. Candidates should be comfortable with cloud-native architecture, testing strategies, scalable services, agile delivery, and secure API development. Experience with Python for automation and data processing is a plus.`;

const INITIAL_STATE: PersistedState = {
  jobDescription: SAMPLE_JOB_DESCRIPTION,
  extractedKeywords: extractTechnicalKeywords(SAMPLE_JOB_DESCRIPTION),
  selectedTechnologies: [],
  questionCount: 10,
  difficultyFilter: 'all',
  generatedQuestions: [],
  answers: {},
  results: null,
  currentQuestionIndex: 0,
  generationCount: 0,
  usedQuestionIds: [],
  usedQuestionKeys: [],
  completedAssessmentCount: 0,
  cumulativeAssessmentScore: 0,
};

export default function App() {
  const restoredState = loadPersistedState();
  const [jobDescription, setJobDescription] = useState(restoredState?.jobDescription ?? INITIAL_STATE.jobDescription);
  const [extractedKeywords, setExtractedKeywords] = useState(
    restoredState?.extractedKeywords ?? INITIAL_STATE.extractedKeywords,
  );
  const [selectedTechnologies, setSelectedTechnologies] = useState(
    restoredState?.selectedTechnologies ?? INITIAL_STATE.selectedTechnologies,
  );
  const [questionCount, setQuestionCount] = useState<number>(
    restoredState?.questionCount ?? INITIAL_STATE.questionCount,
  );
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | 'all'>(
    restoredState?.difficultyFilter ?? INITIAL_STATE.difficultyFilter,
  );
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>(
    restoredState?.generatedQuestions ?? INITIAL_STATE.generatedQuestions,
  );
  const [answers, setAnswers] = useState<Record<string, string>>(restoredState?.answers ?? {});
  const [results, setResults] = useState(restoredState?.results ?? null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(
    restoredState?.currentQuestionIndex ?? 0,
  );
  const [generationCount, setGenerationCount] = useState(
    restoredState?.generationCount ?? 0,
  );
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>(
    restoredState?.usedQuestionIds ?? [],
  );
  const [usedQuestionKeys, setUsedQuestionKeys] = useState<string[]>(
    restoredState?.usedQuestionKeys ?? [],
  );
  const [completedAssessmentCount, setCompletedAssessmentCount] = useState(
    restoredState?.completedAssessmentCount ?? INITIAL_STATE.completedAssessmentCount,
  );
  const [cumulativeAssessmentScore, setCumulativeAssessmentScore] = useState(
    restoredState?.cumulativeAssessmentScore ?? INITIAL_STATE.cumulativeAssessmentScore,
  );
  const [assessmentRunId, setAssessmentRunId] = useState(0);
  const [assessmentMetaCollapsed, setAssessmentMetaCollapsed] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const groupedKeywords = useMemo(
    () => groupKeywordsByCategory(extractedKeywords),
    [extractedKeywords],
  );
  const reservedQuestionKeys = useMemo(
    () =>
      Array.from(
        new Set([...usedQuestionKeys, ...generatedQuestions.map((question) => question.dedupeKey)]),
      ),
    [generatedQuestions, usedQuestionKeys],
  );
  const hasAssessment = generatedQuestions.length > 0 || Boolean(results);
  const averageAssessmentScore =
    completedAssessmentCount > 0
      ? Math.round(cumulativeAssessmentScore / completedAssessmentCount)
      : 0;

  useEffect(() => {
    savePersistedState({
      jobDescription,
      extractedKeywords,
      selectedTechnologies,
      questionCount,
      difficultyFilter,
      generatedQuestions,
      answers,
      results,
      currentQuestionIndex,
      generationCount,
      usedQuestionIds,
      usedQuestionKeys,
      completedAssessmentCount,
      cumulativeAssessmentScore,
    });
  }, [
    answers,
    currentQuestionIndex,
    difficultyFilter,
    extractedKeywords,
    generatedQuestions,
    jobDescription,
    questionCount,
    results,
    selectedTechnologies,
    generationCount,
    usedQuestionIds,
    usedQuestionKeys,
    completedAssessmentCount,
    cumulativeAssessmentScore,
  ]);

  const parseDescription = async () => {
    if (!jobDescription.trim()) {
      setErrorMessage('Enter or upload a job description before parsing.');
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);

    window.setTimeout(() => {
      const matches = extractTechnicalKeywords(jobDescription);
      setExtractedKeywords(matches);
      setSelectedTechnologies([]);
      setGeneratedQuestions([]);
      setAnswers({});
      setResults(null);
      setCurrentQuestionIndex(0);
      setGenerationCount(0);
      setUsedQuestionIds([]);
      setUsedQuestionKeys([]);
      setCompletedAssessmentCount(0);
      setCumulativeAssessmentScore(0);
      setIsParsing(false);
    }, 550);
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) {
      return;
    }

    setIsParsing(true);
    setErrorMessage(null);

    try {
      const content = await parseUploadedFile(file);
      if (!content.trim()) {
        throw new Error('The uploaded file appears to be empty.');
      }
      setJobDescription(content);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to read the uploaded file.',
      );
    } finally {
      setIsParsing(false);
    }
  };

  const toggleTechnology = (technology: string) => {
    setSelectedTechnologies((current) =>
      current.includes(technology)
        ? current.filter((item) => item !== technology)
        : [...current, technology],
    );
  };

  const requestAssessment = async ({
    resetCurrentAssessment,
  }: {
    resetCurrentAssessment: boolean;
  }) => {
    if (selectedTechnologies.length === 0) {
      setErrorMessage('Select at least one technology before generating questions.');
      return;
    }

    const nextReservedQuestionKeys = Array.from(
      new Set([
        ...usedQuestionKeys,
        ...(resetCurrentAssessment
          ? generatedQuestions.map((question) => question.dedupeKey)
          : reservedQuestionKeys),
      ]),
    );

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      const normalizedQuestionCount = Math.max(1, Math.min(30, Math.floor(questionCount || 1)));
      if (normalizedQuestionCount !== questionCount) {
        setQuestionCount(normalizedQuestionCount);
      }

      const nextQuestions = await generateAssessmentQuestions({
        jobDescription,
        selectedTechnologies,
        questionCount: normalizedQuestionCount,
        difficultyFilter,
        generationCount,
        usedQuestionKeys: nextReservedQuestionKeys,
      });

      if (nextQuestions.length === 0) {
        setErrorMessage(
          'No questions were available for the selected technologies and difficulty. Adjust the filters and try again.',
        );
        return;
      }

      setGeneratedQuestions(nextQuestions);
      setAnswers({});
      setResults(null);
      setCurrentQuestionIndex(0);
      setAssessmentRunId((current) => current + 1);
      setGenerationCount((current) => current + 1);
      setUsedQuestionIds((current) => {
        return [...new Set([...current, ...nextQuestions.map((question) => question.id)])];
      });
      setUsedQuestionKeys((current) => {
        return [...new Set([...current, ...nextQuestions.map((question) => question.dedupeKey)])];
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to generate the assessment.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const buildAssessment = async () => {
    await requestAssessment({ resetCurrentAssessment: false });
  };

  const startNewAssessment = async () => {
    await requestAssessment({ resetCurrentAssessment: true });
  };

  const submitAssessment = () => {
    const unanswered = generatedQuestions.filter((question) => !answers[question.id]).length;
    if (
      unanswered > 0 &&
      !window.confirm(
        `You still have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}. Submit anyway?`,
      )
    ) {
      return;
    }

    const nextResults = calculateResults({
      questions: generatedQuestions,
      answers,
    });

    setResults(nextResults);
    setCompletedAssessmentCount((current) => current + 1);
    setCumulativeAssessmentScore((current) => current + nextResults.percentage);
  };

  const restartAssessment = () => {
    setAnswers({});
    setResults(null);
    setCurrentQuestionIndex(0);
    setAssessmentRunId((current) => current + 1);
  };

  const clearSession = () => {
    setJobDescription('');
    setExtractedKeywords([]);
    setSelectedTechnologies([]);
    setGeneratedQuestions([]);
    setAnswers({});
    setResults(null);
    setCurrentQuestionIndex(0);
    setDifficultyFilter('all');
    setQuestionCount(10);
    setGenerationCount(0);
    setUsedQuestionIds([]);
    setUsedQuestionKeys([]);
    setCompletedAssessmentCount(0);
    setCumulativeAssessmentScore(0);
    setErrorMessage(null);
    clearPersistedState();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-0 -z-10 bg-hero-grid bg-hero-grid opacity-90" />
      <div className="mx-auto w-[90vw] max-w-[90vw] px-4 py-8 sm:px-5 lg:px-6">
        <header className="relative overflow-hidden rounded-[36px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-teal-950/70 p-8 shadow-panel">
          <div className="absolute right-8 top-8 z-10">
            <button
              type="button"
              onClick={clearSession}
              className="rounded-full bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
            >
              Clear Session
            </button>
          </div>
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-teal-200">
                Technical Interview Prep
              </div>
              <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-tight text-[#9da6bf] sm:text-5xl">
                Generate Technical Assessment from Job Description
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                Upload a role description, extract the relevant technologies, generate a
                realistic multiple-choice screening, and review strengths and weak areas in
                one polished browser experience.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <FileSearch2 className="h-8 w-8 text-teal-300" />
                <p className="mt-4 text-sm font-semibold text-white">Smart extraction</p>
                <p className="mt-2 text-sm text-slate-400">
                  Local rules-based parsing for common technical stacks.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <BrainCircuit className="h-8 w-8 text-amber-300" />
                <p className="mt-4 text-sm font-semibold text-white">Interview generation</p>
                <p className="mt-2 text-sm text-slate-400">
                  Balanced question sets with difficulty filters and explanations.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <ShieldCheck className="h-8 w-8 text-cyan-300" />
                <p className="mt-4 text-sm font-semibold text-white">Workbook-backed sourcing</p>
                <p className="mt-2 text-sm text-slate-400">
                  Assessments are generated from the local Excel question bank in this project.
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="mt-8 space-y-2">
          <JobDescriptionUploader
            jobDescription={jobDescription}
            onJobDescriptionChange={setJobDescription}
            onFileUpload={handleFileUpload}
            onParse={parseDescription}
            isParsing={isParsing}
            errorMessage={errorMessage}
          />

          <ParsedKeywordsPanel
            extractedKeywords={extractedKeywords}
          />

          <TechnologySelector
            groupedKeywords={groupedKeywords}
            selectedTechnologies={selectedTechnologies}
            onToggleTechnology={toggleTechnology}
            questionCount={questionCount}
            onQuestionCountChange={setQuestionCount}
            questionSourceLabel={QUESTION_SOURCE_LABEL}
            questionSourcePath={QUESTION_SOURCE_PATH}
            difficultyFilter={difficultyFilter}
            onDifficultyFilterChange={setDifficultyFilter}
          />

          {selectedTechnologies.length > 0 ? (
            <>
              <section className="relative rounded-[28px] border border-white/10 bg-slate-900/75 p-6 shadow-panel backdrop-blur">
                <PanelToggle
                  collapsed={assessmentMetaCollapsed}
                  onToggle={() => setAssessmentMetaCollapsed((value) => !value)}
                />
                <div className="pr-[26rem]">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300/80">
                      Assessment Mix
                    </div>
                    <span className="text-sm font-medium text-slate-300">Selected technologies:</span>
                    {selectedTechnologies.map((technology) => (
                      <span
                        key={`selected-inline-${technology}`}
                        className="rounded-full border border-teal-400/30 bg-teal-500/10 px-3 py-1.5 text-sm text-teal-100"
                      >
                        {technology}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                      Assessments taken: {completedAssessmentCount}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                      Average score: {completedAssessmentCount > 0 ? `${averageAssessmentScore}%` : 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="absolute right-20 top-6 z-10 flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={buildAssessment}
                    disabled={isGenerating || selectedTechnologies.length === 0}
                    className="rounded-full bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    {isGenerating ? 'Generating...' : 'Generate Assessment'}
                  </button>
                  {hasAssessment ? (
                    <button
                      type="button"
                      onClick={startNewAssessment}
                      disabled={isGenerating || selectedTechnologies.length === 0}
                      className="rounded-full bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                    >
                      {isGenerating ? 'Refreshing...' : 'New Assessment'}
                    </button>
                    ) : null}
                  </div>
                {errorMessage ? (
                  <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {errorMessage}
                  </div>
                ) : null}
              </section>
              {generatedQuestions.length > 0 && !results ? (
              <AssessmentGenerator
                questions={generatedQuestions}
                assessmentRunId={assessmentRunId}
                currentQuestionIndex={currentQuestionIndex}
                answers={answers}
                onAnswerChange={(questionId, value) =>
                  setAnswers((current) => ({ ...current, [questionId]: value }))
                }
                onNavigate={setCurrentQuestionIndex}
                onSubmit={submitAssessment}
                onRestart={restartAssessment}
              />
              ) : null}
            </>
          ) : null}

          {results ? (
            <ResultsSummary
              questions={generatedQuestions}
              answers={answers}
              results={results}
              onRestart={restartAssessment}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
