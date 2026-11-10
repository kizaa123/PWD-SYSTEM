import { createPortal } from "react-dom";
import { CATEGORY_LABELS, STATUS_LABELS } from "../lib/api";
import { formatAppDateFromIso } from "../lib/dateFormat";
import { SupportTypePrintSections } from "./SupportTypePrintSections";
import type { SupportTypeCategoryGroup } from "./SupportTypeBreakdownPanel";
import type { ReportAppliedRow, ReportPersonRow, YearStatsExport } from "../lib/yearReportExport";

type Props = {
  stats: YearStatsExport;
  generatedAt: string;
  scopeLabel?: string;
  filterLabel: string;
  registeredPeople: ReportPersonRow[];
  appliedPeople: ReportAppliedRow[];
  notAppliedPeople: ReportPersonRow[];
  supportTypeGroups?: SupportTypeCategoryGroup[];
};

function formatDate(iso: string) {
  return formatAppDateFromIso(iso) || iso;
}

function personNameCell(p: ReportPersonRow) {
  return (
    <div className="reports-print-name-block">
      <div>{p.display_name}</div>
      {p.registration_type === "caregiver" && p.beneficiary_name ? (
        <div className="reports-print-cell-sub">PWD: {p.beneficiary_name}</div>
      ) : null}
    </div>
  );
}

export function ReportsPrintSheet({
  stats,
  generatedAt,
  scopeLabel,
  filterLabel,
  registeredPeople,
  appliedPeople,
  notAppliedPeople,
  supportTypeGroups = [],
}: Props) {
  const hasTypeGroups = supportTypeGroups.length > 0;
  const purposeRows = hasTypeGroups ? [] : stats.supportBreakdown.slice(0, 20);

  const sheet = (
    <div className="reports-print-sheet" aria-hidden>
      <header className="reports-print-header">
        <p className="reports-print-org">National Council on Persons with Disability</p>
        <p className="reports-print-org-sub">DACF support register — district report</p>
        <h1 className="reports-print-title">Yearly support report</h1>
        <p className="reports-print-meta">
          Period: <strong>{filterLabel}</strong>
          {scopeLabel ? ` · ${scopeLabel}` : ""} · Printed {generatedAt}
        </p>
      </header>

      <section className="reports-print-section">
        <h2 className="reports-print-section-title">At a glance</h2>
        <table className="reports-print-table reports-print-stat-table">
          <tbody>
            <tr>
              <td className="reports-print-stat-cell">
                <div className="reports-print-stat-label">Registered</div>
                <div className="reports-print-stat-value">{stats.registered}</div>
              </td>
              <td className="reports-print-stat-cell">
                <div className="reports-print-stat-label">Applied</div>
                <div className="reports-print-stat-value">{stats.applied}</div>
              </td>
              <td className="reports-print-stat-cell">
                <div className="reports-print-stat-label">Not applied</div>
                <div className="reports-print-stat-value">{stats.notApplied}</div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="reports-print-section">
        <h2 className="reports-print-section-title">Applicants by support category</h2>
        <table className="reports-print-table reports-print-table-compact">
          <thead>
            <tr>
              <th className="reports-print-th">Category</th>
              <th className="reports-print-th reports-print-th-numeric">Applicants</th>
            </tr>
          </thead>
          <tbody>
            {stats.byCategory.length === 0 ? (
              <tr>
                <td colSpan={2} className="reports-print-td reports-print-td-muted">
                  No applications in this period.
                </td>
              </tr>
            ) : (
              stats.byCategory.map((c) => (
                <tr key={c.category_code}>
                  <td className="reports-print-td">{CATEGORY_LABELS[c.category_code] || c.category_name}</td>
                  <td className="reports-print-td reports-print-td-numeric">{c.applicants}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {!hasTypeGroups && purposeRows.length > 0 ? (
        <section className="reports-print-section">
          <h2 className="reports-print-section-title">Support purpose summary</h2>
          <table className="reports-print-table reports-print-table-compact">
            <thead>
              <tr>
                <th className="reports-print-th">Purpose</th>
                <th className="reports-print-th reports-print-th-numeric">Applicants</th>
              </tr>
            </thead>
            <tbody>
              {purposeRows.map((b) => (
                <tr key={b.label}>
                  <td className="reports-print-td">{b.label}</td>
                  <td className="reports-print-td reports-print-td-numeric">{b.applications}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {hasTypeGroups ? <SupportTypePrintSections groups={supportTypeGroups} /> : null}

      <section className="reports-print-section reports-print-section-roster reports-print-page-break">
        <h2 className="reports-print-section-title">Register — all registered ({registeredPeople.length})</h2>
        <table className="reports-print-table reports-print-roster">
          <thead>
            <tr>
              <th className="reports-print-th">Reg. no.</th>
              <th className="reports-print-th">Name</th>
              <th className="reports-print-th">Type</th>
              <th className="reports-print-th">Phone</th>
              <th className="reports-print-th">Community</th>
              <th className="reports-print-th">Disability</th>
              <th className="reports-print-th">District</th>
              <th className="reports-print-th">Reg. date</th>
            </tr>
          </thead>
          <tbody>
            {registeredPeople.map((p) => (
              <tr key={p.applicant_ref}>
                <td className="reports-print-td reports-print-td-mono">{p.applicant_ref}</td>
                <td className="reports-print-td">{personNameCell(p)}</td>
                <td className="reports-print-td">{p.registration_type === "caregiver" ? "Caregiver" : "PWD"}</td>
                <td className="reports-print-td">{p.phone || "—"}</td>
                <td className="reports-print-td">{p.community || "—"}</td>
                <td className="reports-print-td reports-print-td-wrap">{p.disability_category || "—"}</td>
                <td className="reports-print-td">{p.district_name}</td>
                <td className="reports-print-td reports-print-td-nowrap">{formatDate(p.registered_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="reports-print-section reports-print-section-roster reports-print-page-break">
        <h2 className="reports-print-section-title">Applied for support ({appliedPeople.length})</h2>
        <table className="reports-print-table reports-print-roster">
          <thead>
            <tr>
              <th className="reports-print-th">Reg. no.</th>
              <th className="reports-print-th">Name</th>
              <th className="reports-print-th">App. ref.</th>
              <th className="reports-print-th">Category</th>
              <th className="reports-print-th">Status</th>
              <th className="reports-print-th">App. date</th>
            </tr>
          </thead>
          <tbody>
            {appliedPeople.map((p) => (
              <tr key={`${p.applicant_ref}-${p.application_reference}`}>
                <td className="reports-print-td reports-print-td-mono">{p.applicant_ref}</td>
                <td className="reports-print-td">{personNameCell(p)}</td>
                <td className="reports-print-td reports-print-td-mono">{p.application_reference}</td>
                <td className="reports-print-td">{p.category_name}</td>
                <td className="reports-print-td">{STATUS_LABELS[p.status] || p.status}</td>
                <td className="reports-print-td reports-print-td-nowrap">{formatDate(p.applied_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="reports-print-section reports-print-section-roster reports-print-page-break">
        <h2 className="reports-print-section-title">Registered, not applied ({notAppliedPeople.length})</h2>
        <table className="reports-print-table reports-print-roster">
          <thead>
            <tr>
              <th className="reports-print-th">Reg. no.</th>
              <th className="reports-print-th">Name</th>
              <th className="reports-print-th">Type</th>
              <th className="reports-print-th">Phone</th>
              <th className="reports-print-th">Community</th>
              <th className="reports-print-th">Disability</th>
              <th className="reports-print-th">District</th>
              <th className="reports-print-th">Reg. date</th>
            </tr>
          </thead>
          <tbody>
            {notAppliedPeople.map((p) => (
              <tr key={p.applicant_ref}>
                <td className="reports-print-td reports-print-td-mono">{p.applicant_ref}</td>
                <td className="reports-print-td">{personNameCell(p)}</td>
                <td className="reports-print-td">{p.registration_type === "caregiver" ? "Caregiver" : "PWD"}</td>
                <td className="reports-print-td">{p.phone || "—"}</td>
                <td className="reports-print-td">{p.community || "—"}</td>
                <td className="reports-print-td reports-print-td-wrap">{p.disability_category || "—"}</td>
                <td className="reports-print-td">{p.district_name}</td>
                <td className="reports-print-td reports-print-td-nowrap">{formatDate(p.registered_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="reports-print-footer">
        <p>End of report · {filterLabel}{scopeLabel ? ` · ${scopeLabel}` : ""}</p>
      </footer>
    </div>
  );

  return createPortal(sheet, document.body);
}
