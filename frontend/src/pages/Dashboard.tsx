import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { RegistrationCycleStatus } from "../components/RegistrationCycleStatus";
import { ApplicationReferenceLink } from "../components/ApplicationReferenceLink";
import { StatusBadge } from "../components/StatusBadge";
import { PageTitle } from "../components/PageTitle";
import { LoadingSpinner } from "../components/GlobalLoadingBar";
import {
  CategoryPieChart,
  SupportRequestHistogram,
  YearStatCards,
  type YearCategorySlice,
  type YearSupportBar,
} from "../components/DashboardYearCharts";
import { useAuth } from "../lib/auth";
import { canRegisterApplicants } from "../lib/workflowAccess";

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
  yearStats: YearStats;
  recent: {
    id: string;
    applicant_profile_id?: string;
    reference: string;
    status: string;
    full_name: string;
    category_code: string;
    endorsed_by_name?: string | null;
    applied_current_year?: boolean;
  }[];
  roleView?: string;
};

function YearDashboardBody({ stats }: { stats: YearStats }) {
  return (
    <>
      <YearStatCards
        year={stats.year}
        registered={stats.registered}
        applied={stats.applied}
        notApplied={stats.notApplied}
      />
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <SupportRequestHistogram bars={stats.supportBreakdown} />
        <CategoryPieChart slices={stats.byCategory} />
      </div>
    </>
  );
}

export function DashboardPage() {
  const { has } = useAuth();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  const welfare = canRegisterApplicants(has);

  useEffect(() => {
    api<Dash>("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="text-danger">{error}</div>;
  if (!data?.yearStats) {
    return (
      <div className="flex items-center gap-3 text-muted">
        <LoadingSpinner className="h-6 w-6 text-teal" />
        Loading dashboard…
      </div>
    );
  }

  const { yearStats } = data;
  const yearLabel = yearStats.year;

  if (welfare) {
    return (
      <div>
        <PageTitle
          title="Social welfare dashboard"
          subtitle={`${yearLabel} registration and support activity in your district`}
        />
        <YearDashboardBody stats={yearStats} />

        <section className="dashboard-page mt-8 rounded-2xl bg-surface p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-navy">Your registration queue</h3>
            <Link to="/applications" className="text-sm font-semibold text-teal hover:underline">
              Open application folder
            </Link>
          </div>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted">No cases in registration right now.</p>
          ) : (
            <div className="data-table-scroll">
              <table className="data-table text-left text-sm">
                <thead className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-muted">
                  <tr>
                    <th>Reference</th>
                    <th>Applicant</th>
                    <th>Endorsed</th>
                    <th className="table-cell-status-dashboard">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recent.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80">
                      <td>
                        <ApplicationReferenceLink applicationId={a.id}>{a.reference}</ApplicationReferenceLink>
                      </td>
                      <td className="font-medium text-navy">{a.full_name}</td>
                      <td className="text-muted">{a.endorsed_by_name?.trim() || "—"}</td>
                      <td className="table-cell-status-dashboard">
                        {a.applicant_profile_id ? (
                          <RegistrationCycleStatus
                            row={{
                              id: a.id,
                              applicant_profile_id: a.applicant_profile_id,
                              status: a.status,
                              applied_current_year: a.applied_current_year,
                            }}
                          />
                        ) : (
                          <StatusBadge status={a.status} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="Dashboard" subtitle={`${yearLabel} overview — registrations and applications`} />
      <YearDashboardBody stats={yearStats} />
    </div>
  );
}
