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
