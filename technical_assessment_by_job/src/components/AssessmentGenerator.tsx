import { Clock3, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Question } from '../types';
import { PanelToggle } from './PanelToggle';
import { QuestionCard } from './QuestionCard';

interface AssessmentGeneratorProps {
  questions: Question[];
  assessmentRunId: number;
  currentQuestionIndex: number;
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
  onNavigate: (index: number) => void;
  onSubmit: () => void;
  onRestart: () => void;
}

export function AssessmentGenerator({
  questions,
  assessmentRunId,
  currentQuestionIndex,
  answers,
  onAnswerChange,
  onNavigate,
  onSubmit,
  onRestart,
}: AssessmentGeneratorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    setElapsedSeconds(0);

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [assessmentRunId]);

  const question = questions[currentQuestionIndex];
  const answeredCount = questions.filter((item) => answers[item.id]).length;
  const progressPercent = Math.round(((currentQuestionIndex + 1) / questions.length) * 100);
  const displayTime = new Date(elapsedSeconds * 1000).toISOString().slice(14, 19);

  return (
    <section className="relative rounded-[28px] border border-white/10 bg-slate-900/75 p-6 shadow-panel backdrop-blur">
      <PanelToggle collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="pr-14">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300/80">
            Step 3
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#9da6bf]">Take the assessment</h2>
          <p className="mt-2 text-sm text-slate-300">
            One question at a time, with explanations available after submission.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-200">
            <Clock3 className="h-4 w-4 text-amber-300" />
            {displayTime}
          </div>
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex items-center gap-2 rounded-full bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-teal-400"
          >
            <RefreshCcw className="h-4 w-4" />
            Restart
          </button>
        </div>
      </div>

      {!collapsed ? (
        <>
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              <span>
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span>{answeredCount} answered</span>
            </div>
            <div className="mt-2 h-3 rounded-full bg-slate-800">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-teal-400 via-cyan-300 to-amber-300 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-6">
            <QuestionCard
              question={question}
              selectedAnswer={answers[question.id]}
              onSelectAnswer={(value) => onAnswerChange(question.id, value)}
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-400">
              Use Previous and Next to review all answers before submission.
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={currentQuestionIndex === 0}
                onClick={() => onNavigate(currentQuestionIndex - 1)}
                className="rounded-full bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentQuestionIndex >= questions.length - 1}
                onClick={() => onNavigate(currentQuestionIndex + 1)}
                className="rounded-full bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                Next
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="rounded-full bg-teal-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400"
              >
                Submit Assessment
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
