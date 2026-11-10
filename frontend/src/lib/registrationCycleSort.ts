import { applicationListOutcome } from "./applicantSupportHistory";

const REGISTRATION_PHASE = new Set(["registration", "returned_for_correction", "draft", "submitted"]);
const INTERVIEW_PHASE = new Set(["interview", "under_verification", "under_assessment"]);
const FULFILMENT_WITHOUT_QUALIFICATION = new Set([
  "disbursement",
  "pending_fulfilment",
  "partially_fulfilled",
  "completed",
  "fulfilled",
]);

/** Table order for Application → All status: Complete, Not qualified, in progress, then Apply. */
export const APPLICATION_FOLDER_STATUS_SORT = {
  complete: 0,
  not_qualified: 1,
  in_progress: 2,
  apply: 3,
} as const;

type SortRow = {
  status: string;
  applied_current_year?: boolean;
  office_use_qualified?: string | null;
};

/** Mirrors RegistrationCycleStatus display buckets for list sorting. */
export function registrationCycleSortRank(row: SortRow, hasYearApplication: boolean): number {
  if (!hasYearApplication) return APPLICATION_FOLDER_STATUS_SORT.apply;

  const outcome = applicationListOutcome(row);
  if (outcome?.label === "Complete") return APPLICATION_FOLDER_STATUS_SORT.complete;
  if (outcome?.label === "Not qualified") return APPLICATION_FOLDER_STATUS_SORT.not_qualified;

  if (INTERVIEW_PHASE.has(row.status)) return APPLICATION_FOLDER_STATUS_SORT.in_progress;

  if (FULFILMENT_WITHOUT_QUALIFICATION.has(row.status)) return APPLICATION_FOLDER_STATUS_SORT.complete;

  if (!REGISTRATION_PHASE.has(row.status)) return APPLICATION_FOLDER_STATUS_SORT.in_progress;

  if (row.applied_current_year) return APPLICATION_FOLDER_STATUS_SORT.in_progress;

  return APPLICATION_FOLDER_STATUS_SORT.apply;
}

function parseChronology(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * Application folder: first applied at top (app. date only).
 * Registration date is not used. Rows with no application sort after all applicants.
 */
function applicationApplyInstant(app: { submitted_at?: string | null; created_at?: string } | null | undefined): number | null {
  if (!app) return null;
  return parseChronology(app.submitted_at) ?? parseChronology(app.created_at);
}

export function compareApplicationFolderByApplyOrder(
  a: {
    current_year_application?: { created_at?: string; submitted_at?: string | null } | null;
    applicant_ref?: string;
  },
  b: {
    current_year_application?: { created_at?: string; submitted_at?: string | null } | null;
    applicant_ref?: string;
  },
): number {
  const appA = applicationApplyInstant(a.current_year_application);
  const appB = applicationApplyInstant(b.current_year_application);

  if (appA != null && appB != null) {
    if (appA !== appB) return appA - appB;
    return (a.applicant_ref || "").localeCompare(b.applicant_ref || "");
  }
  if (appA != null) return -1;
  if (appB != null) return 1;

  return (a.applicant_ref || "").localeCompare(b.applicant_ref || "");
}

export function compareApplicationRowByApplyOrder(
  a: { created_at: string; submitted_at?: string | null; reference: string },
  b: { created_at: string; submitted_at?: string | null; reference: string },
): number {
  const tA = parseChronology(a.submitted_at) ?? parseChronology(a.created_at) ?? Number.MAX_SAFE_INTEGER;
  const tB = parseChronology(b.submitted_at) ?? parseChronology(b.created_at) ?? Number.MAX_SAFE_INTEGER;
  if (tA !== tB) return tA - tB;
  return a.reference.localeCompare(b.reference);
}
