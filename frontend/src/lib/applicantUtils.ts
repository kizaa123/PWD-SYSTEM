const NON_SUBSTANTIVE_STATUSES = new Set(["cancelled", "rejected"]);

export const COMPLETED_YEAR_STATUSES = new Set([
  "disbursement",
  "pending_fulfilment",
  "partially_fulfilled",
  "completed",
  "fulfilled",
]);

export function isSubstantiveYearApplication(app: {
  status: string;
  office_use_qualified?: string | null;
}): boolean {
  if (NON_SUBSTANTIVE_STATUSES.has(app.status)) return false;
  if (app.status === "registration") {
    const q = app.office_use_qualified?.trim();
    return q === "qualified" || q === "not_qualified";
  }
  return true;
}

export function profileHasAppliedForSupportYear(
  applications: { application_year: number; status: string; office_use_qualified?: string | null }[],
  year = new Date().getFullYear(),
): boolean {
  return applications.some((a) => a.application_year === year && isSubstantiveYearApplication(a));
}

/** Person is closed for further Apply actions this year (submitted apply, including post-registration). */
export function profileSupportYearClosed(
  applications: { application_year: number; status: string; office_use_qualified?: string | null }[],
  year = new Date().getFullYear(),
): boolean {
  return profileHasAppliedForSupportYear(applications, year);
}

export function profileHasCompletedSupportYear(
  applications: { application_year: number; status: string }[],
  year = new Date().getFullYear(),
): boolean {
  return applications.some((a) => a.application_year === year && COMPLETED_YEAR_STATUSES.has(a.status));
}

export function formatSex(sex: string | null | undefined) {
  if (!sex) return "—";
  return sex === "male" ? "Male" : sex === "female" ? "Female" : sex;
}

export function formatResidenceType(type: string | null | undefined, other: string | null | undefined) {
  if (!type?.trim()) return "—";
  if (type === "Other" && other?.trim()) return other.trim();
  return type;
}

export function relationshipLabel(relationship: string, relationshipOther: string | null | undefined) {
  if (relationship === "Other" && relationshipOther?.trim()) return relationshipOther.trim();
  return relationship || "—";
}
