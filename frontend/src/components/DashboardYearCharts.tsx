import { CATEGORY_LABELS, pesewasToGhs } from "../lib/api";

export type YearCategorySlice = {
  category_code: string;
  category_name: string;
  applicants: number;
  requested_pesewas: number;
};

export type YearSupportBar = {
  label: string;
  requested_pesewas: number;
  applications: number;
};

const CAT_COLORS: Record<string, string> = {
  education: "#2563EB",
  health: "#16834A",
  income_generating: "#0F9D91",
  caregivers: "#B7791F",
  assistive_device: "#12345A",
};

export function CategoryPieChart({ slices }: { slices: YearCategorySlice[] }) {
  const totalApplicants = slices.reduce((n, s) => n + s.applicants, 0) || 1;
  let angle = 0;
  const parts = slices.map((s) => {
    const pct = (s.applicants / totalApplicants) * 100;
    const start = angle;
    angle += pct;
    return {
      ...s,
      pct,
      start,
      color: CAT_COLORS[s.category_code] || "#64748B",
      label: CATEGORY_LABELS[s.category_code] || s.category_name || s.category_code,
    };
  });
  const gradient =
    parts.length > 0
      ? `conic-gradient(${parts.map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`).join(",")})`
      : "conic-gradient(#e2e8f0 0 100%)";

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold text-navy">Support by category</h3>
      <p className="mt-0.5 text-xs text-muted">Applicants who applied this year, grouped by support type.</p>
      {slices.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">No category applications recorded for this year yet.</p>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative h-40 w-40 shrink-0 rounded-full" style={{ background: gradient }}>
            <div className="absolute inset-6 flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
              <div className="text-2xl font-bold text-navy">{totalApplicants}</div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted">Applicants</div>
            </div>
          </div>
          <ul className="w-full min-w-0 space-y-3 text-sm">
            {parts.map((s) => (
              <li key={s.category_code} className="flex items-start gap-3">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-navy">{s.label}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span>
                      <span className="font-semibold text-navy">{s.applicants}</span> applicant{s.applicants === 1 ? "" : "s"}
                    </span>
                    <span>{Math.round(s.pct)}% of total</span>
                    <span>{pesewasToGhs(s.requested_pesewas)} requested</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function SupportRequestHistogram({ bars }: { bars: YearSupportBar[] }) {
  const max = Math.max(...bars.map((b) => b.requested_pesewas), 1);
  const top = bars.slice(0, 12);

  return (
    <section className="rounded-2xl bg-surface p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold text-navy">Requested support breakdown</h3>
      <p className="mt-0.5 text-xs text-muted">Total amounts requested by purpose (school fees, surgery, tools, etc.) this year.</p>
      {top.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted">No support purpose details for this year yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {top.map((bar) => {
            const widthPct = Math.max(4, Math.round((bar.requested_pesewas / max) * 100));
            return (
              <li key={bar.label}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-navy">{bar.label}</span>
                  <span className="text-xs text-muted">
                    {pesewasToGhs(bar.requested_pesewas)}
                    <span className="mx-1">·</span>
                    {bar.applications} applicant{bar.applications === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal transition-all"
                    style={{ width: `${widthPct}%` }}
                    role="presentation"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function YearStatCards({
  year,
  yearLabel,
  registered,
  applied,
  notApplied,
  totalRequestedPesewas,
}: {
  year?: number;
  yearLabel?: string;
  registered: number;
  applied: number;
  notApplied: number;
  totalRequestedPesewas: number;
}) {
  const period = yearLabel ?? (year != null ? String(year) : "this period");
  const cards = [
    {
      label: "Registered",
      value: registered,
      hint: yearLabel ? `Registrations in scope (${period})` : `New registrations in ${period}`,
      tone: "text-navy",
    },
    {
      label: "Applied",
      value: applied,
      hint: yearLabel ? `Distinct applicants with support requests (${period})` : `Applicants who opened support in ${period}`,
      tone: "text-teal",
    },
    {
      label: "Not applied",
      value: notApplied,
      hint: yearLabel
        ? `Registered in scope with no support request (${period})`
        : `Registered in ${period} without a support request yet`,
      tone: "text-warning",
    },
    {
      label: "Total requested",
      value: pesewasToGhs(totalRequestedPesewas),
      hint: `Sum of amounts requested (${period})`,
      tone: "text-info",
      isMoney: true,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-slate-100 bg-surface p-4 shadow-sm sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">{card.label}</div>
          <div
            className={`mt-2 font-bold tracking-tight text-navy ${card.isMoney ? "text-2xl" : "text-3xl"} ${card.tone}`}
          >
            {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">{card.hint}</p>
        </div>
      ))}
    </div>
  );
}
