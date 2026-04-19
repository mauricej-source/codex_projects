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
    <article className="rounded-[28px] border border-black/10 bg-[#9da6bf] p-6 text-black">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/15 bg-white/35 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-black">
          {question.technology}
        </span>
        <span className="rounded-full border border-black/15 bg-white/35 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-black">
          {question.difficulty}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-semibold leading-8 text-black">{question.prompt}</h3>

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
                  ? 'border-black/25 bg-white/55'
                  : 'border-black/10 bg-white/25 hover:border-black/25 hover:bg-white/45'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  selected
                    ? 'border-black/30 bg-black text-white'
                    : 'border-black/35 text-transparent'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <span className="text-lg leading-7 text-black">{choice}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
