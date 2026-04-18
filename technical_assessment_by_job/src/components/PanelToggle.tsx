import { ChevronDown, ChevronUp } from 'lucide-react';

interface PanelToggleProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function PanelToggle({ collapsed, onToggle }: PanelToggleProps) {
  const Icon = collapsed ? ChevronDown : ChevronUp;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
      className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition hover:border-teal-300/60 hover:bg-teal-500/10"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
