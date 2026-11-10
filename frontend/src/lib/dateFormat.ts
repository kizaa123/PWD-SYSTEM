const MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May.", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Time portion shared across the app (not used in the sidebar live clock). */
export function formatAppTime(d: Date): string {
  return d.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** e.g. 04.Nov.2026 */
export function formatAppDate(d: Date): string {
  return `${pad2(d.getDate())}.${MONTHS[d.getMonth()]}${d.getFullYear()}`;
}

/** Date without year — for stacked year + datetime columns. e.g. 04.Nov. */
export function formatAppDateWithoutYear(d: Date): string {
  return `${pad2(d.getDate())}.${MONTHS[d.getMonth()]}`;
}

export function formatAppDateFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatAppDate(d);
}

/** Application table: date the person applied (submit time, else file opened). */
export function formatApplicationApplyDateFromIso(
  app: { submitted_at?: string | null; created_at?: string } | null | undefined,
): string {
  if (!app) return "";
  const iso = app.submitted_at?.trim() || app.created_at;
  return formatAppDateFromIso(iso);
}

/** e.g. 04.Nov.2026 3:02 PM */
export function formatAppDateTime(d: Date): string {
  return `${formatAppDate(d)} ${formatAppTime(d)}`;
}

export function formatAppDateTimeFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatAppDateTime(d);
}

/** Stacked cell: year on line 1, system date/time (no year) on line 2. */
export function formatAppHistoryYearStack(iso: string | null | undefined, year: number | null | undefined): {
  yearLine: string;
  whenLine: string;
} {
  const yearLine = year != null ? String(year) : "—";
  if (!iso) return { yearLine, whenLine: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { yearLine, whenLine: "" };
  const whenLine = `${formatAppDateWithoutYear(d)} ${formatAppTime(d)}`;
  return { yearLine, whenLine };
}
