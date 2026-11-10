import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { PageTitle } from "../components/PageTitle";
import { LoadingSpinner } from "../components/GlobalLoadingBar";
import { Button } from "../components/StatusBadge";
import {
  CategoryPieChart,
  SupportRequestHistogram,
  YearStatCards,
} from "../components/DashboardYearCharts";
import { ReportsPrintSheet } from "../components/ReportsPrintSheet";
import {
  ReportAppliedTable,
  ReportNotAppliedTable,
  ReportRegisteredTable,
} from "../components/ReportRosterTable";
import {
  SupportTypeBreakdownPanel,
  type SupportTypeCategoryGroup,
} from "../components/SupportTypeBreakdownPanel";
import {
  downloadYearReportCsv,
  type ReportAppliedRow,
  type ReportPersonRow,
  type YearStatsExport,
} from "../lib/yearReportExport";
import { useAuth } from "../lib/auth";
import { formatAppDateFromIso, formatAppDateTimeFromIso } from "../lib/dateFormat";

type YearFilter = number | "all";

type YearReportResponse = {
  filterYear: YearFilter;
  year: number;
  availableYears: number[];
  yearStats: YearStatsExport;
  registeredPeople: ReportPersonRow[];
  appliedPeople: ReportAppliedRow[];
  notAppliedPeople: ReportPersonRow[];
  generatedAt: string;
  scope: { scope_level: string; region_id?: string | null; district_id?: string | null }[];
  supportTypeGroups?: SupportTypeCategoryGroup[];
};

function scopeSummary(scopes: YearReportResponse["scope"]): string {
  if (!scopes?.length) return "Your assigned scope";
  if (scopes.some((s) => s.scope_level === "national")) return "National scope";
  const levels = [...new Set(scopes.map((s) => s.scope_level))];
  return levels.map((l) => l.replaceAll("_", " ")).join(", ");
}

function filterLabel(filter: YearFilter): string {
  return filter === "all" ? "All years" : String(filter);
}

export function ReportsPage() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<YearFilter>(currentYear);
  const [data, setData] = useState<YearReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rosterTab, setRosterTab] = useState<"registered" | "applied" | "notApplied">("registered");

  const load = useCallback((year: YearFilter) => {
    setLoading(true);
    setError("");
    const q = year === "all" ? "all" : encodeURIComponent(year);
    api<YearReportResponse>(`/api/reports?year=${q}`)
      .then((res) => {
        setData(res);
        setSelectedYear(res.filterYear);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(selectedYear);
  }, [load, selectedYear]);

  const yearOptions = useMemo(() => {
    const fromApi = data?.availableYears ?? [];
    const set = new Set<number>([...fromApi, currentYear]);
    if (typeof selectedYear === "number") set.add(selectedYear);
    return [...set].filter((y) => y > 2000).sort((a, b) => b - a);
  }, [data?.availableYears, selectedYear, currentYear]);

  const generatedLabel = data ? formatAppDateTimeFromIso(data.generatedAt) : "";
  const generatedPrintLabel = data ? formatAppDateFromIso(data.generatedAt) : "";
  const scopeLabel = data ? scopeSummary(data.scope) : scopeSummary(user?.scopes ?? []);
  const activeFilterLabel = data ? filterLabel(data.filterYear) : filterLabel(selectedYear);

  function exportCsv() {
    if (!data?.yearStats) return;
    downloadYearReportCsv(data.yearStats, generatedLabel, {
      filterLabel: activeFilterLabel,
      registeredPeople: data.registeredPeople,
      appliedPeople: data.appliedPeople,
      notAppliedPeople: data.notAppliedPeople,
    });
  }

  function exportPdf() {
    window.print();
  }

  const stats = data?.yearStats;

  return (
    <div className="reports-page">
      {stats && data ? (
        <ReportsPrintSheet
          stats={stats}
          generatedAt={generatedPrintLabel}
          scopeLabel={scopeLabel}
          filterLabel={activeFilterLabel}
          registeredPeople={data.registeredPeople}
          appliedPeople={data.appliedPeople}
          notAppliedPeople={data.notAppliedPeople}
          supportTypeGroups={data.supportTypeGroups}
        />
      ) : null}

      <div className="no-print">
      <PageTitle
        title="Reports"
        subtitle="Registration and application lists, support categories, and grouped support types (who requested school fees, technical aid, health needs, and more)."
      />

      <div className="no-print mb-6 rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-navy">Filters</h2>
        <p className="mt-1 text-xs text-muted">
          Pick a support year (newest first) or all years. Export and print include names and registration details.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="report-year" className="mb-1 block text-xs font-medium text-muted">
              Report period
            </label>
            <select
              id="report-year"
              className="min-w-[10rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-teal focus:ring-1 focus:ring-teal disabled:opacity-60"
              value={selectedYear === "all" ? "all" : String(selectedYear)}
              disabled={loading}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedYear(v === "all" ? "all" : Number(v));
              }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
              <option value="all">All years</option>
            </select>
          </div>
          <Button
            type="button"
            tone="ghost"
            disabled={loading}
            onClick={() => load(selectedYear)}
            aria-label="Refresh report"
          >
            <span className="inline-flex items-center gap-2">
              <svg
                className={`h-4 w-4 ${loading ? "icon-refresh-spin" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <path
                  d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0 0 14-2M19 5a9 9 0 0 0-14 2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Refresh
            </span>
          </Button>
          <div className="flex w-full flex-wrap gap-2 sm:ms-auto sm:w-auto">
            <Button type="button" tone="ghost" onClick={exportCsv} disabled={!stats || loading}>
              Export CSV
            </Button>
            <Button type="button" tone="ghost" onClick={exportPdf} disabled={!stats || loading}>
              Print / PDF
            </Button>
          </div>
        </div>
        {data && (
          <p className="mt-3 text-xs text-muted">
            Showing <span className="font-semibold text-navy">{activeFilterLabel}</span> · Last loaded {generatedLabel}{" "}
            · {scopeLabel}
            {loading ? " · Updating…" : ""}
          </p>
        )}
      </div>

      {error && (
        <p className="no-print mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading && !stats && (
        <div className="no-print flex items-center gap-3 text-sm text-muted">
          <LoadingSpinner className="h-5 w-5 text-teal" />
          Loading report…
        </div>
      )}

      {stats && data && (
        <div className={`space-y-5 transition-opacity ${loading ? "pointer-events-none opacity-50" : ""}`}>
          <YearStatCards
            year={stats.yearFilterAll ? undefined : stats.year}
            registered={stats.registered}
            applied={stats.applied}
            notApplied={stats.notApplied}
            yearLabel={stats.yearFilterAll ? activeFilterLabel : undefined}
          />
          <div className="grid gap-5 xl:grid-cols-2">
            <SupportRequestHistogram bars={stats.supportBreakdown} />
            <CategoryPieChart slices={stats.byCategory} />
          </div>

          <SupportTypeBreakdownPanel
            groups={data.supportTypeGroups ?? []}
            yearLabel={activeFilterLabel}
            variant="reports"
          />

          <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-semibold text-navy">People in this report</h2>
            <p className="mt-1 text-xs text-muted">
              Registered in the selected period, those who applied for support, and registered persons who have not
              applied.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
              {(
                [
                  ["registered", "Registered"],
                  ["applied", "Applied"],
                  ["notApplied", "Not applied"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    rosterTab === id ? "bg-teal text-white" : "bg-slate-100 text-navy hover:bg-slate-200"
                  }`}
                  onClick={() => setRosterTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4">
              {rosterTab === "registered" && <ReportRegisteredTable rows={data.registeredPeople} />}
              {rosterTab === "applied" && <ReportAppliedTable rows={data.appliedPeople} />}
              {rosterTab === "notApplied" && <ReportNotAppliedTable rows={data.notAppliedPeople} />}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
