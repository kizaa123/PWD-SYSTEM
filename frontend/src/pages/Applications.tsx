import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, formatSupportYearWithDateTime, formatSupportYearWithDateTimeMobileLines, STATUS_LABELS } from "../lib/api";
import { ApplyForSupportLink } from "../components/ApplyForSupportLink";
import { RegistrationCycleStatus } from "../components/RegistrationCycleStatus";
import { ApplicationReferenceLink } from "../components/ApplicationReferenceLink";
import { ReferenceNumber, inputClass } from "../components/StatusBadge";
import { applicationSupportTypeColumnLabel } from "../lib/applicationSupportDisplay";
import { PageTitle } from "../components/PageTitle";
import { useAuth } from "../lib/auth";
import { registrationListPrimaryName, registrationListPrimaryPhone } from "../lib/registrationListDisplay";
import { canOpenApplicationsList, visibleApplicationStatuses, workflowQueues } from "../lib/workflowAccess";

type ApplicationRow = {
  id: string;
  applicant_profile_id: string;
  reference: string;
  full_name: string;
  category_code: string;
  category_name: string;
  status: string;
  application_year: number;
  purpose_summary: string | null;
  created_at: string;
  endorsed_by_name?: string | null;
  applied_current_year?: boolean;
  office_use_qualified?: string | null;
};

type CurrentYearApplication = {
  id: string;
  reference: string;
  status: string;
  category_code: string;
  category_name: string;
  purpose_summary: string | null;
  created_at: string;
  application_year: number;
  office_use_qualified?: string | null;
};

type RegisterFolderRow = {
  id: string;
  full_name: string;
  applicant_ref: string;
  phone: string | null;
  registration_type?: string;
  caregiver_full_name?: string | null;
  caregiver_phone?: string | null;
  created_at?: string;
  registered_by_name: string | null;
  registration_source: string;
  applied_current_year: boolean;
  has_year_application: boolean;
  current_year_application: CurrentYearApplication | null;
};

const WORKFLOW_STATUS_FILTER = [
  "registration",
  "interview",
  "selection",
  "disbursement",
  "completed",
  "returned_for_correction",
  "partially_fulfilled",
  "rejected",
  "on_hold",
  "cancelled",
];

const UNAPPLIED_STATUS = "un_applied";
const APPLIED_FOLDER_STATUS = "applied";

/** Application folder filters (intake / yearly requests). */
const APPLICATION_FOLDER_STATUSES = ["", UNAPPLIED_STATUS, APPLIED_FOLDER_STATUS, "returned_for_correction"] as const;

const APPLICATION_FOLDER_LABELS: Record<string, string> = {
  "": "All status",
  [UNAPPLIED_STATUS]: "Non-Applicant",
  [APPLIED_FOLDER_STATUS]: "Applicant",
  returned_for_correction: "Return Correction",
};

function normalizeFolderStatus(status: string): string {
  if (status === "registration") return APPLIED_FOLDER_STATUS;
  return status;
}

function isApplicationFolderStatus(status: string): boolean {
  const normalized = normalizeFolderStatus(status);
  return (APPLICATION_FOLDER_STATUSES as readonly string[]).includes(normalized);
}

const CURRENT_APPLICATION_YEAR = new Date().getFullYear();

function endorsedByLabel(row: RegisterFolderRow) {
  if (row.registered_by_name?.trim()) return row.registered_by_name.trim();
  if (row.registration_source === "self") return "Self-registered (legacy)";
  return "—";
}

export function ApplicationsPage() {
  const { user, has, isRole } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [registerRows, setRegisterRows] = useState<RegisterFolderRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const rawStatus = params.get("status") || "";
  const status = normalizeFolderStatus(rawStatus);
  const q = params.get("q") || "";
  const visible = visibleApplicationStatuses(user, has, isRole);
  const allowedWorkflowStatuses =
    visible === null ? WORKFLOW_STATUS_FILTER : WORKFLOW_STATUS_FILTER.filter((s) => visible.includes(s));
  const queues = workflowQueues(user, has, isRole);
  const isRegisterFolderView =
    status === "" || status === UNAPPLIED_STATUS || status === APPLIED_FOLDER_STATUS;
  const isReturnCorrectionView = status === "returned_for_correction";
  const canPickUnapplied = has("applications.create");
  const usesApplicationFolder =
    canOpenApplicationsList(user, has, isRole) || has("applications.submit", "applications.create");
  const inApplicationFolder = usesApplicationFolder && isApplicationFolderStatus(rawStatus);

  useEffect(() => {
    if (rawStatus === "registration" && inApplicationFolder) {
      const next = new URLSearchParams(params);
      next.set("status", APPLIED_FOLDER_STATUS);
      navigate(`/applications?${next.toString()}`, { replace: true });
    }
  }, [rawStatus, inApplicationFolder, params, navigate]);

  useEffect(() => {
    if (!status || status === UNAPPLIED_STATUS) return;
    if (usesApplicationFolder && isApplicationFolderStatus(rawStatus)) return;
    if (visible && !visible.includes(status)) {
      navigate(queues[0]?.to || "/", { replace: true });
    }
  }, [status, rawStatus, visible, queues, navigate, usesApplicationFolder]);

  useEffect(() => {
    const canViewNonApplicant = canPickUnapplied || canOpenApplicationsList(user, has, isRole);
    if (status === UNAPPLIED_STATUS && !canViewNonApplicant) {
      navigate(queues[0]?.to || "/applications", { replace: true });
    }
  }, [status, canPickUnapplied, user, has, isRole, queues, navigate]);

  useEffect(() => {
    setListLoading(true);
    setRegisterRows([]);
    setRows([]);
    if (inApplicationFolder && isRegisterFolderView) {
      const appliedFilter =
        status === UNAPPLIED_STATUS ? "not_applied" : status === APPLIED_FOLDER_STATUS ? "applied" : "all";
      const qs = new URLSearchParams({ appliedFilter });
      if (q.trim()) qs.set("q", q.trim());
      api<RegisterFolderRow[]>(`/api/applicants?${qs}`)
        .then(setRegisterRows)
        .catch(() => setRegisterRows([]))
        .finally(() => setListLoading(false));
      return;
    }
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (inApplicationFolder && isReturnCorrectionView) {
      qs.set("year", String(CURRENT_APPLICATION_YEAR));
    }
    if (q.trim()) qs.set("q", q.trim());
    api<ApplicationRow[]>(`/api/applications?${qs}`)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setListLoading(false));
  }, [status, q, inApplicationFolder, isRegisterFolderView, isReturnCorrectionView]);

  const filteredRegisterRows = useMemo(() => {
    let list = registerRows;
    if (status === UNAPPLIED_STATUS) {
      list = list.filter((r) => !r.applied_current_year);
    } else if (status === APPLIED_FOLDER_STATUS) {
      list = list.filter((r) => r.applied_current_year);
    }
    const sorted = [...list].sort((a, b) =>
      registrationListPrimaryName(a).localeCompare(registrationListPrimaryName(b)),
    );
    const query = q.trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter(
      (a) =>
        registrationListPrimaryName(a).toLowerCase().includes(query) ||
        a.full_name.toLowerCase().includes(query) ||
        a.applicant_ref.toLowerCase().includes(query) ||
        registrationListPrimaryPhone(a).toLowerCase().includes(query) ||
        (a.current_year_application?.reference || "").toLowerCase().includes(query),
    );
  }, [registerRows, q, status]);

  const pageTitle = inApplicationFolder
    ? status === ""
      ? "Application"
      : (APPLICATION_FOLDER_LABELS[status] ?? "Application")
    : status
      ? STATUS_LABELS[status] || "Applications"
      : "Applications";

  const folderFilterOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [{ value: "", label: APPLICATION_FOLDER_LABELS[""] }];
    if (canPickUnapplied || canOpenApplicationsList(user, has, isRole)) {
      opts.push({ value: UNAPPLIED_STATUS, label: APPLICATION_FOLDER_LABELS[UNAPPLIED_STATUS] });
    }
    if (visible === null || visible.includes("registration")) {
      opts.push({ value: APPLIED_FOLDER_STATUS, label: APPLICATION_FOLDER_LABELS[APPLIED_FOLDER_STATUS] });
    }
    if (visible === null || visible.includes("returned_for_correction")) {
      opts.push({ value: "returned_for_correction", label: APPLICATION_FOLDER_LABELS.returned_for_correction });
    }
    return opts;
  }, [visible, canPickUnapplied, user, has, isRole]);

  const folderSubtitle = isRegisterFolderView
    ? status === UNAPPLIED_STATUS
      ? `Registered persons who still need to apply for ${CURRENT_APPLICATION_YEAR} (including intake drafts not yet submitted).`
      : status === APPLIED_FOLDER_STATUS
        ? `Registered persons with a ${CURRENT_APPLICATION_YEAR} support request on file (any workflow stage).`
        : `Everyone registered in your area. Applied persons show their ${CURRENT_APPLICATION_YEAR} request; others can start Apply.`
    : isReturnCorrectionView
        ? "Requests returned for correction before they can continue in the workflow."
        : "One support category per yearly request. Applicant profiles are kept permanently; each year opens a new request with its own reference.";

  const selectStatus = inApplicationFolder ? (rawStatus === "registration" ? APPLIED_FOLDER_STATUS : status) : status;

  return (
    <div className="applications-page space-y-4">
      <PageTitle title={pageTitle} subtitle={folderSubtitle} />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          className={`${inputClass} w-full sm:max-w-xs`}
          placeholder="Search reference or name"
          value={q}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            next.set("q", e.target.value);
            setParams(next);
          }}
        />
        <select
          className={`${inputClass} w-full sm:max-w-xs`}
          value={selectStatus}
          onChange={(e) => {
            const next = new URLSearchParams(params);
            const v = e.target.value;
            if (v) next.set("status", v);
            else next.delete("status");
            setParams(next);
          }}
        >
          {inApplicationFolder ? (
            folderFilterOptions.map((o) => (
              <option key={o.value || "__all__"} value={o.value}>
                {o.label}
              </option>
            ))
          ) : (
            <>
              <option value="">All statuses</option>
              {allowedWorkflowStatuses.map((s) => (
                <option key={s} value={s}>
                  {s === "registration" ? "Application" : STATUS_LABELS[s] || s.replaceAll("_", " ")}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
      <div className="data-table-scroll rounded-2xl bg-surface shadow-sm">
        {listLoading ? (
          <p className="px-4 py-6 text-sm text-muted">Loading…</p>
        ) : inApplicationFolder && isRegisterFolderView ? (
          <table className="data-table text-left text-sm">
            <thead className="bg-canvas text-muted">
              <tr>
                <th>Reference</th>
                <th>Phone</th>
                <th className="table-cell-date-apps">
                  <span className="sm:hidden">Year / date</span>
                  <span className="hidden sm:inline">Year · date &amp; time</span>
                </th>
                <th>Applicant</th>
                <th>Category</th>
                <th className="table-cell-nowrap-sm min-w-[5.5rem]">
                  <span className="sm:hidden">Support</span>
                  <span className="hidden sm:inline">Type of support</span>
                </th>
                <th>
                  <span className="sm:hidden">Endorsed</span>
                  <span className="hidden sm:inline">Endorsed by</span>
                </th>
                <th className="table-cell-status-apps">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRegisterRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted">
                    No records match this search.
                  </td>
                </tr>
              ) : (
                filteredRegisterRows.map((r) => {
                  const app = r.current_year_application;
                  const eventAt = app?.created_at || r.created_at || new Date().toISOString();
                  const year = app?.application_year ?? CURRENT_APPLICATION_YEAR;
                  const mobileWhen = formatSupportYearWithDateTimeMobileLines(year, eventAt);
                  return (
                    <tr key={r.id} className="border-t border-canvas">
                      <td>
                        {app ? (
                          <ApplicationReferenceLink applicationId={app.id}>{app.reference}</ApplicationReferenceLink>
                        ) : (
                          <ReferenceNumber>{r.applicant_ref}</ReferenceNumber>
                        )}
                      </td>
                      <td>{registrationListPrimaryPhone(r)}</td>
                      <td className="table-cell-date-apps text-[11px] sm:text-sm">
                        <span className="sm:hidden">
                          <span className="block font-semibold text-navy">{mobileWhen.line1}</span>
                          {mobileWhen.line2 ? (
                            <span className="mt-0.5 block text-[10px] font-normal text-muted">{mobileWhen.line2}</span>
                          ) : null}
                        </span>
                        <span className="hidden sm:inline sm:whitespace-nowrap">
                          {formatSupportYearWithDateTime(year, eventAt)}
                        </span>
                      </td>
                      <td>{registrationListPrimaryName(r)}</td>
                      <td>{app?.category_name || "—"}</td>
                      <td className="text-sm leading-snug">
                        {app
                          ? applicationSupportTypeColumnLabel(
                              app.category_code,
                              app.category_name,
                              app.purpose_summary,
                            )
                          : "—"}
                      </td>
                      <td>{endorsedByLabel(r)}</td>
                      <td className="table-cell-status-apps">
                        {app ? (
                          <RegistrationCycleStatus
                            row={{
                              id: app.id,
                              applicant_profile_id: r.id,
                              status: app.status,
                              applied_current_year: r.applied_current_year,
                              office_use_qualified: app.office_use_qualified,
                            }}
                          />
                        ) : (
                          <ApplyForSupportLink applicantProfileId={r.id} />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table text-left text-sm">
            <thead className="bg-canvas text-muted">
              <tr>
                <th>Reference</th>
                <th className="table-cell-date-apps">
                  <span className="sm:hidden">Year / date</span>
                  <span className="hidden sm:inline">Year · date &amp; time</span>
                </th>
                <th>Applicant</th>
                <th>Category</th>
                <th className="table-cell-nowrap-sm min-w-[5.5rem]">
                  <span className="sm:hidden">Support</span>
                  <span className="hidden sm:inline">Type of support</span>
                </th>
                <th>
                  <span className="sm:hidden">Endorsed</span>
                  <span className="hidden sm:inline">Endorsed by</span>
                </th>
                <th className="table-cell-status-apps">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted">
                    No records match this search.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const mobileWhen = formatSupportYearWithDateTimeMobileLines(r.application_year, r.created_at);
                  return (
                    <tr key={r.id} className="border-t border-canvas">
                      <td>
                        <ApplicationReferenceLink applicationId={r.id}>{r.reference}</ApplicationReferenceLink>
                      </td>
                      <td className="table-cell-date-apps text-[11px] sm:text-sm">
                        <span className="sm:hidden">
                          <span className="block font-semibold text-navy">{mobileWhen.line1}</span>
                          {mobileWhen.line2 ? (
                            <span className="mt-0.5 block text-[10px] font-normal text-muted">{mobileWhen.line2}</span>
                          ) : null}
                        </span>
                        <span className="hidden sm:inline sm:whitespace-nowrap">
                          {formatSupportYearWithDateTime(r.application_year, r.created_at)}
                        </span>
                      </td>
                      <td>{r.full_name}</td>
                      <td>{r.category_name}</td>
                      <td className="text-sm leading-snug">
                        {applicationSupportTypeColumnLabel(
                          r.category_code,
                          r.category_name,
                          r.purpose_summary,
                        )}
                      </td>
                      <td>{r.endorsed_by_name?.trim() || "—"}</td>
                      <td className="table-cell-status-apps">
                        <RegistrationCycleStatus row={r} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
