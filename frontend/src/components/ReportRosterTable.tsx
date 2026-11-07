import type { ReportAppliedRow, ReportPersonRow } from "../lib/yearReportExport";
import { pesewasToGhs, STATUS_LABELS } from "../lib/api";
import { formatAppDateFromIso } from "../lib/dateFormat";

function formatDate(iso: string) {
  return formatAppDateFromIso(iso) || iso;
}

function PersonCells({ p, compact }: { p: ReportPersonRow; compact?: boolean }) {
  return (
    <>
      <td className="font-mono text-xs">{p.applicant_ref}</td>
      <td className={compact ? "max-w-[8rem]" : ""}>{p.display_name}</td>
      <td className="text-xs">{p.registration_type === "caregiver" ? "Caregiver" : "PWD"}</td>
      <td>{p.phone || "—"}</td>
      <td className="text-xs">{p.community || "—"}</td>
      <td className="text-xs">{p.district_name}</td>
      {!compact && <td className="text-xs text-muted">{formatDate(p.registered_at)}</td>}
    </>
  );
}

export function ReportRegisteredTable({ rows }: { rows: ReportPersonRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No registrations in this filter.</p>;
  }
  return (
    <div className="data-table-scroll max-h-[28rem] rounded-xl border border-slate-200 bg-white">
      <table className="data-table text-left text-xs sm:text-sm">
        <thead className="sticky top-0 bg-canvas text-muted">
          <tr>
            <th>Ref.</th>
            <th>Name</th>
            <th>Type</th>
            <th>Phone</th>
            <th>Community</th>
            <th className="hidden sm:table-cell">Disability</th>
            <th>District</th>
            <th>Registered</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.applicant_ref} className="border-t border-canvas">
              <PersonCells p={p} />
              <td className="hidden text-xs sm:table-cell">{p.disability_category || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportAppliedTable({ rows }: { rows: ReportAppliedRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted">No applications in this filter.</p>;
  }
  return (
    <div className="data-table-scroll max-h-[28rem] rounded-xl border border-slate-200 bg-white">
      <table className="data-table text-left text-xs sm:text-sm">
        <thead className="sticky top-0 bg-canvas text-muted">
          <tr>
            <th>Ref.</th>
            <th>Name</th>
            <th>Type</th>
            <th>Phone</th>
            <th>App. ref.</th>
            <th>Year</th>
            <th>Category</th>
            <th>Req.</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={`${p.applicant_ref}-${p.application_reference}`} className="border-t border-canvas">
              <PersonCells p={p} compact />
              <td className="font-mono text-xs">{p.application_reference}</td>
              <td>{p.application_year}</td>
              <td className="text-xs">{p.category_name}</td>
              <td className="whitespace-nowrap text-xs">
                {p.amount_requested_pesewas != null ? pesewasToGhs(p.amount_requested_pesewas) : "—"}
              </td>
              <td className="text-xs">{STATUS_LABELS[p.status] || p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ReportNotAppliedTable({ rows }: { rows: ReportPersonRow[] }) {
  return <ReportRegisteredTable rows={rows} />;
}
