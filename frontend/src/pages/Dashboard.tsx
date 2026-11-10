import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { PageTitle } from "../components/PageTitle";
import { LoadingSpinner } from "../components/GlobalLoadingBar";
import { DashboardYearPicker } from "../components/DashboardYearPicker";
import {
  CategoryPieChart,
  SupportRequestHistogram,
  YearStatCards,
  type YearCategorySlice,
  type YearSupportBar,
} from "../components/DashboardYearCharts";
import {
  SupportTypeBreakdownPanel,
  type SupportTypeCategoryGroup,
} from "../components/SupportTypeBreakdownPanel";
import { useAuth } from "../lib/auth";
import { canRegisterApplicants } from "../lib/workflowAccess";
import { formatAppDate } from "../lib/dateFormat";

function scopeSummary(scopes: { scope_level: string }[] | undefined): string {
  if (!scopes?.length) return "Your assigned scope";
  if (scopes.some((s) => s.scope_level === "national")) return "National scope";
  const levels = [...new Set(scopes.map((s) => s.scope_level))];
  return levels.map((l) => l.replaceAll("_", " ")).join(", ");
}

type YearStats = {
  year: number;
  registered: number;
  applied: number;
  notApplied: number;
  totalRequestedPesewas: number;
  byCategory: YearCategorySlice[];
  supportBreakdown: YearSupportBar[];
};

type Dash = {
  selectedYear: number;
  availableYears: number[];
  yearStats: YearStats;
  supportTypeGroups: SupportTypeCategoryGroup[];
  roleView?: string;
};

function YearDashboardBody({
  stats,
  supportTypeGroups,
  yearLabel,
  loading,
  printMeta,
}: {
  stats: YearStats;
  supportTypeGroups: SupportTypeCategoryGroup[];
  yearLabel: string;
  loading: boolean;
  printMeta: { scopeLabel: string; generatedAt: string };
}) {
  return (
    <div className={`space-y-5 transition-opacity ${loading ? "pointer-events-none opacity-60" : ""}`}>
      <div className="no-print space-y-5">
        <YearStatCards
          year={stats.year}
          yearLabel={yearLabel}
          registered={stats.registered}
          applied={stats.applied}
          notApplied={stats.notApplied}
        />
        <div className="grid gap-5 xl:grid-cols-2">
          <SupportRequestHistogram bars={stats.supportBreakdown} />
          <CategoryPieChart slices={stats.byCategory} />
        </div>
      </div>
      <SupportTypeBreakdownPanel
        groups={supportTypeGroups}
        yearLabel={yearLabel}
        variant="dashboard"
        printMeta={printMeta}
      />
    </div>
  );
}

export function DashboardPage() {
  const { has, user } = useAuth();
  const currentCalendarYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentCalendarYear);
  const userPickedYear = useRef(false);
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const welfare = canRegisterApplicants(has);

  /** Each visit to Dashboard starts on the current support year; past years are opt-in via the picker. */
  useEffect(() => {
    userPickedYear.current = false;
    setSelectedYear(currentCalendarYear);
  }, [currentCalendarYear]);

  useEffect(() => {
    const syncCalendarYear = () => {
      if (document.visibilityState !== "visible") return;
      if (!userPickedYear.current) {
        setSelectedYear(new Date().getFullYear());
      }
    };
    document.addEventListener("visibilitychange", syncCalendarYear);
    return () => document.removeEventListener("visibilitychange", syncCalendarYear);
  }, []);

  const load = useCallback((year: number) => {
    setLoading(true);
    setError("");
    api<Dash>(`/api/dashboard?year=${encodeURIComponent(year)}`)
      .then((res) => {
        setData(res);
        setSelectedYear(res.selectedYear ?? year);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(selectedYear);
  }, [load, selectedYear]);

  const yearOptions = useMemo(() => {
    const fromApi = data?.availableYears ?? [];
    return [...new Set([currentCalendarYear, selectedYear, ...fromApi])]
      .filter((y) => y > 2000)
      .sort((a, b) => b - a);
  }, [data?.availableYears, selectedYear, currentCalendarYear]);

  if (error && !data?.yearStats) {
    return <div className="text-danger">{error}</div>;
  }

  if (!data?.yearStats) {
    return (
      <div className="flex items-center gap-3 text-muted">
        <LoadingSpinner className="h-6 w-6 text-teal" />
        Loading dashboard…
      </div>
    );
  }

  const { yearStats, supportTypeGroups } = data;
  const yearLabel = String(selectedYear);
  const printMeta = {
    scopeLabel: scopeSummary(user?.scopes),
    generatedAt: formatAppDate(new Date()),
  };

  return (
    <div className="dashboard-page">
      <div className="no-print">
        <PageTitle
          title={welfare ? "Social welfare dashboard" : "Dashboard"}
          subtitle={
            welfare
              ? `Registrations and support requests for ${yearLabel} in your district`
              : `${yearLabel} overview — Education, Health, and Income generating support`
          }
        />
        <div className="mb-5">
          <DashboardYearPicker
            selectedYear={selectedYear}
            years={yearOptions}
            loading={loading}
            onChange={(year) => {
              userPickedYear.current = true;
              setSelectedYear(year);
            }}
          />
          {error ? (
            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
        </div>
      </div>
      <YearDashboardBody
        stats={yearStats}
        supportTypeGroups={supportTypeGroups ?? []}
        yearLabel={yearLabel}
        loading={loading}
        printMeta={printMeta}
      />
    </div>
  );
}
