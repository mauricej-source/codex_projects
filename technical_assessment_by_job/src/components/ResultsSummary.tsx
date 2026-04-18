import { Award, RotateCcw, Target } from 'lucide-react';
import { useState } from 'react';
import type { AssessmentResult, Question } from '../types';
import { PanelToggle } from './PanelToggle';

interface ResultsSummaryProps {
  questions: Question[];
  answers: Record<string, string>;
  results: AssessmentResult;
  onRestart: () => void;
}

export function ResultsSummary({
  questions,
  answers,
  results,
  onRestart,
}: ResultsSummaryProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="relative rounded-[28px] border border-white/10 bg-slate-900/75 p-6 shadow-panel backdrop-blur">
      <PanelToggle collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="pr-14">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300/80">
            Results
          </p>
          <h2 className="mt-1 text-3xl font-bold text-white">Assessment summary</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Review final performance, weak areas, and each explanation before regenerating
            another interview set.
          </p>
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
        >
          <RotateCcw className="h-4 w-4" />
          Restart Assessment
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Award className="h-4 w-4 text-amber-300" />
                Final score
              </div>
              <div className="mt-4 text-4xl font-bold text-white">{results.percentage}%</div>
              <p className="mt-2 text-sm text-slate-400">
                {results.correctCount} correct out of {results.total}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <div className="text-sm font-medium text-slate-300">Pass threshold</div>
              <div className="mt-4 text-4xl font-bold text-white">70%</div>
              <p
                className={`mt-2 text-sm font-medium ${
                  results.passed ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {results.passed ? 'Pass' : 'Below target'}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Target className="h-4 w-4 text-teal-300" />
                Recommended focus areas
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {results.recommendedFocusAreas.length > 0 ? (
                  results.recommendedFocusAreas.map((area) => (
                    <span
                      key={area}
                      className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-sm text-amber-100"
                    >
                      {area}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">No weak areas flagged.</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {results.categoryBreakdown.map((item) => {
              const percent = Math.round((item.correct / item.total) * 100);
              return (
                <div
                  key={item.label}
                  className="rounded-3xl border border-white/10 bg-slate-950/60 p-5"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-white">{item.label}</span>
                    <span className="text-slate-400">
                      {item.correct}/{item.total}
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-teal-400 to-amber-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 space-y-4">
            {questions.map((question, index) => {
              const userAnswer = answers[question.id];
              const isCorrect = userAnswer === question.correctAnswer;
              return (
                <article
                  key={question.id}
                  className="rounded-3xl border border-white/10 bg-slate-950/60 p-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Question {index + 1} • {question.technology} • {question.difficulty}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-white">{question.prompt}</h3>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${
                        isCorrect
                          ? 'bg-emerald-500/15 text-emerald-200'
                          : 'bg-rose-500/15 text-rose-200'
                      }`}
                    >
                      {isCorrect ? 'Correct' : 'Missed'}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Your Answer
                      </div>
                      <div className="mt-2 text-sm text-slate-100">
                        {userAnswer ?? 'No answer selected'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-teal-400/15 bg-teal-500/10 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
                        Correct Answer
                      </div>
                      <div className="mt-2 text-sm text-teal-50">{question.correctAnswer}</div>
                    </div>
                    <div className="rounded-2xl border border-amber-300/15 bg-amber-400/10 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
                        Explanation
                      </div>
                      <div className="mt-2 text-sm text-amber-50">{question.explanation}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
