import { CheckCircle2 } from 'lucide-react';
import type { Question } from '../types';

interface QuestionCardProps {
  question: Question;
  selectedAnswer?: string;
  onSelectAnswer: (answer: string) => void;
}

export function QuestionCard({
  question,
  selectedAnswer,
  onSelectAnswer,
}: QuestionCardProps) {
  return (
    <article className="rounded-[28px] border border-white/10 bg-slate-950/60 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-teal-400/20 bg-teal-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
          {question.technology}
        </span>
        <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100">
          {question.difficulty}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-semibold leading-8 text-white">{question.prompt}</h3>

      <div className="mt-6 space-y-3">
        {question.choices.map((choice) => {
          const selected = selectedAnswer === choice;
          return (
            <button
              key={choice}
              type="button"
              onClick={() => onSelectAnswer(choice)}
              className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition ${
                selected
                  ? 'border-teal-400 bg-teal-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  selected
                    ? 'border-teal-300 bg-teal-400 text-slate-950'
                    : 'border-slate-500 text-transparent'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <span className="text-lg leading-7 text-slate-100">{choice}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
