import { CATEGORY_LABELS, pesewasToGhs, STATUS_LABELS } from "../lib/api";
import { formatAppDateFromIso } from "../lib/dateFormat";
import type { ReportAppliedRow, ReportPersonRow, YearStatsExport } from "../lib/yearReportExport";

type Props = {
  stats: YearStatsExport;
  generatedAt: string;
  scopeLabel?: string;
  filterLabel: string;
  registeredPeople: ReportPersonRow[];
  appliedPeople: ReportAppliedRow[];
  notAppliedPeople: ReportPersonRow[];
};

function PrintRow({ label, value }: { label: string; value: string | number }) {
  return (
    <tr>
      <th className="reports-print-th">{label}</th>
      <td className="reports-print-td">{value}</td>
    </tr>
  );
}

function formatDate(iso: string) {
  return formatAppDateFromIso(iso) || iso;
}

export function ReportsPrintSheet({
  stats,
  generatedAt,
  scopeLabel,
  filterLabel,
  registeredPeople,
  appliedPeople,
  notAppliedPeople,
}: Props) {
  const topBars = stats.supportBreakdown.slice(0, 14);

  return (
    <div className="reports-print-sheet hidden print:block" aria-hidden>
      <header className="reports-print-header">
        <p className="reports-print-org">National Council on Persons with Disability</p>
        <h1 className="reports-print-title">Yearly support report — {filterLabel}</h1>
        <p className="reports-print-meta">
          Generated {generatedAt}
          {scopeLabel ? ` · ${scopeLabel}` : ""}
        </p>
      </header>

      <section className="reports-print-section">
        <h2 className="reports-print-section-title">Summary</h2>
        <table className="reports-print-table">
          <tbody>
            <PrintRow label="Registered" value={stats.registered} />
            <PrintRow label="Applied" value={stats.applied} />
            <PrintRow label="Not applied" value={stats.notApplied} />
            <PrintRow label="Total requested" value={pesewasToGhs(stats.totalRequestedPesewas)} />
          </tbody>
        </table>
      </section>

      <section className="reports-print-section">
        <h2 className="reports-print-section-title">By support category</h2>
        <table className="reports-print-table">
          <thead>
            <tr>
              <th className="reports-print-th">Category</th>
              <th className="reports-print-th">Applicants</th>
              <th className="reports-print-th">Requested</th>
            </tr>
          </thead>
          <tbody>
            {stats.byCategory.map((c) => (
              <tr key={c.category_code}>
                <td className="reports-print-td">{CATEGORY_LABELS[c.category_code] || c.category_name}</td>
                <td className="reports-print-td">{c.applicants}</td>
                <td className="reports-print-td">{pesewasToGhs(c.requested_pesewas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="reports-print-section">
        <h2 className="reports-print-section-title">Requested support breakdown</h2>
        <table className="reports-print-table">
          <thead>
            <tr>
              <th className="reports-print-th">Purpose</th>
              <th className="reports-print-th">Applications</th>
              <th className="reports-print-th">Requested</th>
            </tr>
          </thead>
          <tbody>
            {topBars.map((b) => (
              <tr key={b.label}>
                <td className="reports-print-td">{b.label}</td>
                <td className="reports-print-td">{b.applications}</td>
                <td className="reports-print-td">{pesewasToGhs(b.requested_pesewas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="reports-print-section reports-print-page-break">
        <h2 className="reports-print-section-title">Registered ({registeredPeople.length})</h2>
        <table className="reports-print-table reports-print-roster">
          <thead>
            <tr>
              <th className="reports-print-th">No.</th>
              <th className="reports-print-th">Name</th>
              <th className="reports-print-th">Type</th>
              <th className="reports-print-th">Phone</th>
              <th className="reports-print-th">Community</th>
              <th className="reports-print-th">Disability</th>
              <th className="reports-print-th">District</th>
              <th className="reports-print-th">Registered</th>
            </tr>
          </thead>
          <tbody>
            {registeredPeople.map((p) => (
              <tr key={p.applicant_ref}>
                <td className="reports-print-td">{p.applicant_ref}</td>
                <td className="reports-print-td">{p.display_name}</td>
                <td className="reports-print-td">{p.registration_type === "caregiver" ? "Caregiver" : "PWD"}</td>
                <td className="reports-print-td">{p.phone || "—"}</td>
                <td className="reports-print-td">{p.community || "—"}</td>
                <td className="reports-print-td">{p.disability_category || "—"}</td>
                <td className="reports-print-td">{p.district_name}</td>
                <td className="reports-print-td">{formatDate(p.registered_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="reports-print-section reports-print-page-break">
        <h2 className="reports-print-section-title">Applied ({appliedPeople.length})</h2>
        <table className="reports-print-table reports-print-roster">
          <thead>
            <tr>
              <th className="reports-print-th">No.</th>
              <th className="reports-print-th">Name</th>
              <th className="reports-print-th">App. ref.</th>
              <th className="reports-print-th">Year</th>
              <th className="reports-print-th">Category</th>
              <th className="reports-print-th">Requested</th>
              <th className="reports-print-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {appliedPeople.map((p) => (
              <tr key={`${p.applicant_ref}-${p.application_reference}`}>
                <td className="reports-print-td">{p.applicant_ref}</td>
                <td className="reports-print-td">{p.display_name}</td>
                <td className="reports-print-td">{p.application_reference}</td>
                <td className="reports-print-td">{p.application_year}</td>
                <td className="reports-print-td">{p.category_name}</td>
                <td className="reports-print-td">
                  {p.amount_requested_pesewas != null ? pesewasToGhs(p.amount_requested_pesewas) : "—"}
                </td>
                <td className="reports-print-td">{STATUS_LABELS[p.status] || p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="reports-print-section reports-print-page-break">
        <h2 className="reports-print-section-title">Registered, not applied ({notAppliedPeople.length})</h2>
        <table className="reports-print-table reports-print-roster">
          <thead>
            <tr>
              <th className="reports-print-th">No.</th>
              <th className="reports-print-th">Name</th>
              <th className="reports-print-th">Type</th>
              <th className="reports-print-th">Phone</th>
              <th className="reports-print-th">Community</th>
              <th className="reports-print-th">Disability</th>
              <th className="reports-print-th">District</th>
            </tr>
          </thead>
          <tbody>
            {notAppliedPeople.map((p) => (
              <tr key={p.applicant_ref}>
                <td className="reports-print-td">{p.applicant_ref}</td>
                <td className="reports-print-td">{p.display_name}</td>
                <td className="reports-print-td">{p.registration_type === "caregiver" ? "Caregiver" : "PWD"}</td>
                <td className="reports-print-td">{p.phone || "—"}</td>
                <td className="reports-print-td">{p.community || "—"}</td>
                <td className="reports-print-td">{p.disability_category || "—"}</td>
                <td className="reports-print-td">{p.district_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
