import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { KeywordMatch } from '../types';
import { PanelToggle } from './PanelToggle';

interface ParsedKeywordsPanelProps {
  extractedKeywords: KeywordMatch[];
}

export function ParsedKeywordsPanel({
  extractedKeywords,
}: ParsedKeywordsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section>
      <article className="relative rounded-[28px] border border-white/10 bg-slate-900/75 p-6 shadow-panel backdrop-blur">
        <PanelToggle collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        <div className="flex items-center gap-2 pr-14 text-sm font-semibold uppercase tracking-[0.24em] text-amber-300/90">
          <Sparkles className="h-4 w-4" />
          Extracted Keywords
        </div>
        <h3 className="mt-1 text-xl font-bold text-white">Technical focus signals</h3>
        {!collapsed ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {extractedKeywords.length > 0 ? (
              extractedKeywords.map((item) => (
                <span
                  key={`${item.category}-${item.keyword}`}
                  className="rounded-full border border-teal-400/20 bg-teal-500/10 px-3 py-2 text-sm font-medium text-teal-100"
                >
                  {item.keyword}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-400">
                Technical keywords appear here after parsing.
              </p>
            )}
          </div>
        ) : null}
      </article>
    </section>
  );
}
