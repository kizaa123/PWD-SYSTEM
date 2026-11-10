type Props = {
  selectedYear: number;
  years: number[];
  loading?: boolean;
  onChange: (year: number) => void;
};

export function DashboardYearPicker({ selectedYear, years, loading, onChange }: Props) {
  const options = [...new Set([selectedYear, ...years])].filter((y) => y > 2000).sort((a, b) => b - a);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-surface px-4 py-3 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Support year</p>
        <p className="text-[11px] text-muted">Stats and support types follow the year you select.</p>
      </div>
      <div
        className="flex flex-1 flex-wrap justify-end gap-1.5 sm:gap-2"
        role="group"
        aria-label="Select support year"
      >
        {options.map((y) => {
          const active = y === selectedYear;
          return (
            <button
              key={y}
              type="button"
              disabled={loading}
              className={`min-w-[3.25rem] rounded-xl px-3 py-2 text-sm font-bold tabular-nums transition disabled:opacity-50 ${
                active
                  ? "bg-teal text-white shadow-md shadow-teal/25"
                  : "bg-slate-100 text-navy hover:bg-slate-200"
              }`}
              onClick={() => onChange(y)}
            >
              {y}
            </button>
          );
        })}
      </div>
    </div>
  );
}
