/** Disbursement / fulfilment — treated as complete when qualification is not recorded. */
const COMPLETE_WORKFLOW = new Set([
  "disbursement",
  "pending_fulfilment",
  "partially_fulfilled",
  "completed",
  "fulfilled",
]);

export type ApplicantSupportHistoryRow = {
  id: string;
  reference: string;
  category_code: string;
  category_name?: string | null;
  application_year: number;
  status: string;
  amount_requested_pesewas: number | null;
  amount_approved_pesewas: number | null;
  created_at: string;
  office_use_qualified?: string | null;
};

export type ApplicantHistoryOutcome = {
  label: "Complete" | "Not qualified";
  tone: "complete" | "notQualified";
};

/**
 * History lists only finalized support outcomes (Complete / Not qualified).
 * Excludes registration saves, intake drafts, and in-progress workflow (interview, etc.).
 */
export function isApplicantSupportHistoryRecord(
  row: Pick<ApplicantSupportHistoryRow, "status" | "office_use_qualified">,
): boolean {
  const q = row.office_use_qualified?.trim();
  if (q === "qualified" || q === "not_qualified") return true;
  if (COMPLETE_WORKFLOW.has(row.status)) return true;
  if (row.status === "rejected") return true;
  return false;
}

/** Applications list + status column: same Complete / Not qualified as history once office-use is recorded. */
export function applicationListOutcome(
  row: Pick<ApplicantSupportHistoryRow, "status" | "office_use_qualified">,
): ApplicantHistoryOutcome | null {
  const q = row.office_use_qualified?.trim();
  if (q === "not_qualified") {
    return { label: "Not qualified", tone: "notQualified" };
  }
  if (q === "qualified") {
    return { label: "Complete", tone: "complete" };
  }
  return null;
}

export function applicantSupportHistoryOutcome(
  row: Pick<ApplicantSupportHistoryRow, "status" | "office_use_qualified">,
): ApplicantHistoryOutcome {
  const q = row.office_use_qualified?.trim();
  if (q === "not_qualified") {
    return { label: "Not qualified", tone: "notQualified" };
  }
  if (q === "qualified") {
    return { label: "Complete", tone: "complete" };
  }
  if (row.status === "rejected") {
    return { label: "Not qualified", tone: "notQualified" };
  }
  return { label: "Complete", tone: "complete" };
}

export function sortApplicantSupportHistory<T extends { application_year: number; created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.application_year !== b.application_year) return b.application_year - a.application_year;
    return String(b.created_at).localeCompare(String(a.created_at));
  });
}

/** One finalized support record per application year (newest first within the year). */
export function filterApplicantSupportHistoryForDisplay<T extends ApplicantSupportHistoryRow>(rows: T[]): T[] {
  const sorted = sortApplicantSupportHistory(rows.filter(isApplicantSupportHistoryRecord));
  const byYear = new Map<number, T>();
  for (const row of sorted) {
    if (!byYear.has(row.application_year)) {
      byYear.set(row.application_year, row);
    }
  }
  return sortApplicantSupportHistory([...byYear.values()]);
}
