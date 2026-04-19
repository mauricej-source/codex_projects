import { FileText, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { PanelToggle } from './PanelToggle';

interface JobDescriptionUploaderProps {
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  onFileUpload: (file: File | null) => void;
  onParse: () => void;
  isParsing: boolean;
  errorMessage: string | null;
}

export function JobDescriptionUploader({
  jobDescription,
  onJobDescriptionChange,
  onFileUpload,
  onParse,
  isParsing,
  errorMessage,
}: JobDescriptionUploaderProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="relative rounded-[28px] border border-white/10 bg-slate-900/75 p-6 shadow-panel backdrop-blur">
      <div className="absolute right-20 top-6 z-10">
        <button
          type="button"
          onClick={onParse}
          disabled={isParsing}
          className="inline-flex h-10 items-center justify-center rounded-full bg-teal-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {isParsing ? 'Parsing description...' : 'Extract Keywords'}
        </button>
      </div>
      <PanelToggle collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="pr-24 sm:pr-52">
        <div className="pr-14">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300/80">
            Step 1
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#9da6bf]">
            Upload or paste a job description
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Supported formats: TXT, PDF, and DOCX. You can also paste the content directly
            to quickly test the app without sample files.
          </p>
        </div>
      </div>

      {!collapsed ? (
        <>
          <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
            <label className="group flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-center transition hover:border-teal-400/70 hover:bg-teal-500/10">
              <div className="rounded-2xl bg-white/10 p-4 text-teal-300">
                <UploadCloud className="h-10 w-10" />
              </div>
              <p className="mt-5 text-lg font-semibold text-white">Drag a file here or browse</p>
              <p className="mt-2 max-w-sm text-sm text-slate-300">
                Client-side parsing keeps everything local in your browser session.
              </p>
              <span className="mt-5 inline-flex rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-200">
                Choose TXT, PDF, or DOCX
              </span>
              <input
                className="sr-only"
                type="file"
                accept=".txt,.pdf,.docx"
                onChange={(event) => onFileUpload(event.target.files?.[0] ?? null)}
              />
            </label>

            <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-300">
                <FileText className="h-4 w-4 text-teal-300" />
                Paste job description
              </div>
              <textarea
                value={jobDescription}
                onChange={(event) => onJobDescriptionChange(event.target.value)}
                placeholder="Paste the technical job description here..."
                className="min-h-[220px] w-full rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-teal-400"
              />
            </div>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {errorMessage}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
