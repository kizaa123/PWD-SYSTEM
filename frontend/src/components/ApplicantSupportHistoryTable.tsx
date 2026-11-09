import { CATEGORY_LABELS } from "../lib/api";
import { formatAppHistoryYearStack } from "../lib/dateFormat";
import {
  applicantSupportHistoryOutcome,
  filterApplicantSupportHistoryForDisplay,
  type ApplicantSupportHistoryRow,
} from "../lib/applicantSupportHistory";
import { applicationSupportTypeColumnLabel } from "../lib/applicationSupportDisplay";
import { ApplicationReferenceLink } from "./ApplicationReferenceLink";

export type AssistiveDeviceHistoryRow = {
  id: string;
  reference: string;
  application_year: number;
  assistive_device_key: string | null;
  assistive_device_type: string | null;
};

export type StartupToolHistoryRow = {
  id: string;
  reference: string;
  application_year: number;
  tool_name: string;
};

type Props = {
  rows: ApplicantSupportHistoryRow[];
  assistiveDeviceHistory?: AssistiveDeviceHistoryRow[];
  startupToolHistory?: StartupToolHistoryRow[];
  title?: string;
  emptyMessage?: string;
  className?: string;
};

const OUTCOME_CLASS: Record<string, string> = {
  complete: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  notQualified: "bg-red-50 text-red-800 ring-red-200/80",
};

function OutcomeBadge({ status, officeUseQualified }: { status: string; officeUseQualified?: string | null }) {
  const outcome = applicantSupportHistoryOutcome({ status, office_use_qualified: officeUseQualified });
  return (
    <span
      className={`inline-flex max-w-full items-center justify-center rounded-md px-2 py-1 text-center text-[11px] font-semibold leading-tight ring-1 ring-inset sm:px-2.5 sm:text-xs ${OUTCOME_CLASS[outcome.tone]}`}
    >
      {outcome.label}
    </span>
  );
}

function supportLabel(row: ApplicantSupportHistoryRow): string {
  return applicationSupportTypeColumnLabel(
    row.category_code,
    row.category_name || CATEGORY_LABELS[row.category_code] || row.category_code,
    row.purpose_summary,
  );
}

export function ApplicantSupportHistoryTable({
  rows,
  assistiveDeviceHistory = [],
  startupToolHistory = [],
  title = "Yearly support application history",
  emptyMessage = "No previous yearly support requests on file for this applicant.",
  className = "",
}: Props) {
  const displayRows = filterApplicantSupportHistoryForDisplay(rows);
  const visibleRefs = new Set(displayRows.map((r) => r.reference));
  const deviceRows = assistiveDeviceHistory.filter((h) => visibleRefs.has(h.reference));
  const toolRows = startupToolHistory.filter((h) => visibleRefs.has(h.reference));
  const hasDevices = deviceRows.length > 0;
  const hasTools = toolRows.length > 0;

  return (
    <section className={`applicant-support-history ${className}`.trim()}>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3>

      {displayRows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <>
          <ul className="space-y-3 sm:hidden">
            {displayRows.map((a) => {
              const when = formatAppHistoryYearStack(a.created_at, a.application_year);
              return (
                <li
                  key={a.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-navy">{when.yearLine}</p>
                      {when.whenLine ? (
                        <p className="mt-0.5 text-[10px] text-muted">{when.whenLine}</p>
                      ) : null}
                      <p className="mt-2 text-xs font-semibold text-teal">
                        <ApplicationReferenceLink applicationId={a.id}>{a.reference}</ApplicationReferenceLink>
                      </p>
                    </div>
                    <div className="shrink-0 max-w-[42%]">
                      <OutcomeBadge status={a.status} officeUseQualified={a.office_use_qualified} />
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">Category</dt>
                      <dd className="text-right font-medium text-navy">
                        {a.category_name || CATEGORY_LABELS[a.category_code] || a.category_code}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="shrink-0 text-muted">Support</dt>
                      <dd className="text-right font-medium leading-snug text-navy">{supportLabel(a)}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>

          <div className="hidden sm:block data-table-scroll rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="data-table text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  <th className="table-cell-year-stack">Year</th>
                  <th>Reference</th>
                  <th>Category</th>
                  <th className="min-w-[6.5rem]">Support</th>
                  <th className="table-cell-nowrap-sm min-w-[5.5rem]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayRows.map((a) => {
                  const when = formatAppHistoryYearStack(a.created_at, a.application_year);
                  return (
                    <tr key={a.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="table-cell-year-stack text-slate-600">
                        <span className="block font-semibold text-navy leading-tight">{when.yearLine}</span>
                        {when.whenLine ? (
                          <span className="mt-0.5 block text-[10px] font-normal leading-snug text-slate-500 sm:text-[11px]">
                            {when.whenLine}
                          </span>
                        ) : null}
                      </td>
                      <td className="font-semibold text-navy">
                        <ApplicationReferenceLink applicationId={a.id}>{a.reference}</ApplicationReferenceLink>
                      </td>
                      <td className="text-navy">
                        {a.category_name || CATEGORY_LABELS[a.category_code] || a.category_code}
                      </td>
                      <td className="text-sm font-medium leading-snug text-navy">{supportLabel(a)}</td>
                      <td className="table-cell-nowrap-sm align-middle">
                        <OutcomeBadge status={a.status} officeUseQualified={a.office_use_qualified} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {hasTools ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/90 px-4 py-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Start-up tools requested</p>
          <ul className="space-y-1.5 text-sm text-navy">
            {toolRows.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                <span className="font-semibold text-slate-700">{h.application_year}</span>
                <span>{h.tool_name}</span>
                <span className="text-slate-500">({h.reference})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasDevices ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/90 px-4 py-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Assistive devices requested</p>
          <ul className="space-y-1.5 text-sm text-navy">
            {deviceRows.map((h) => (
              <li key={h.id} className="flex flex-wrap gap-x-2 gap-y-0.5">
                <span className="font-semibold text-slate-700">{h.application_year}</span>
                <span>{h.assistive_device_type || h.assistive_device_key || "Device"}</span>
                <span className="text-slate-500">({h.reference})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
