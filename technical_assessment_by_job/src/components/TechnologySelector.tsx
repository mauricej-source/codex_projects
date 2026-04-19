import { useMemo, useState } from 'react';
import type { Difficulty, TechnologyCategory } from '../types';
import { PanelToggle } from './PanelToggle';

interface TechnologySelectorProps {
  groupedKeywords: Record<TechnologyCategory, string[]>;
  selectedTechnologies: string[];
  onToggleTechnology: (technology: string) => void;
  questionCount: number;
  onQuestionCountChange: (value: number) => void;
  questionSourceLabel: string;
  questionSourcePath: string;
  difficultyFilter: Difficulty | 'all';
  onDifficultyFilterChange: (value: Difficulty | 'all') => void;
}

export function TechnologySelector({
  groupedKeywords,
  selectedTechnologies,
  onToggleTechnology,
  questionCount,
  onQuestionCountChange,
  questionSourceLabel,
  questionSourcePath,
  difficultyFilter,
  onDifficultyFilterChange,
}: TechnologySelectorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const populatedCategories = useMemo(
    () =>
      Object.entries(groupedKeywords).filter(([, technologies]) => technologies.length > 0) as Array<
        [TechnologyCategory, string[]]
      >,
    [groupedKeywords],
  );

  return (
    <section className="relative rounded-[28px] border border-white/10 bg-slate-900/75 p-6 shadow-panel backdrop-blur">
      <PanelToggle collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="pr-14">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300/80">
            Step 2
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#9da6bf]">
            Select technologies for the interview set
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Each category contains only keywords found in the uploaded description. Choose
            one or more technologies, then generate a balanced assessment.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Question Count
            </span>
            <input
              type="number"
              min={1}
              max={30}
              value={questionCount}
              onChange={(event) =>
                onQuestionCountChange(Number(event.target.value))
              }
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-400 focus:outline-none"
            />
          </label>

          <label className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Difficulty
            </span>
            <select
              value={difficultyFilter}
              onChange={(event) =>
                onDifficultyFilterChange(event.target.value as Difficulty | 'all')
              }
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-400 focus:outline-none"
            >
              <option value="all">Mixed difficulty</option>
              <option value="easy">Easy only</option>
              <option value="medium">Medium only</option>
              <option value="hard">Hard only</option>
            </select>
          </label>
        </div>
      </div>

      {!collapsed ? (
        <>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
            Question source: <span className="font-semibold text-white">{questionSourceLabel}</span>
            <span className="ml-2 text-slate-400">({questionSourcePath})</span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {populatedCategories.length > 0 ? (
              populatedCategories.map(([category, technologies]) => (
                <div
                  key={category}
                  className="rounded-3xl border border-white/10 bg-slate-950/60 p-4"
                >
                  <div className="flex w-full items-center justify-between gap-3 text-left">
                    <div>
                      <p className="text-sm font-semibold text-white">{category}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {technologies.length} extracted keyword{technologies.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {technologies.map((technology) => {
                      const selected = selectedTechnologies.includes(technology);
                      return (
                        <button
                          key={technology}
                          type="button"
                          onClick={() => onToggleTechnology(technology)}
                          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                            selected
                              ? 'border-teal-400 bg-teal-500 text-slate-950'
                              : 'border-white/10 bg-white/5 text-slate-200 hover:border-teal-300/60 hover:bg-teal-500/10'
                          }`}
                        >
                          {technology}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-slate-950/50 p-6 text-sm text-slate-400 lg:col-span-2">
                Parse a job description to populate technology categories.
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
