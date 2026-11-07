import { beginLoading, endLoading } from "./loading";
import { formatAppDateTimeFromIso, formatAppHistoryYearStack } from "./dateFormat";

const TOKEN_KEY = "pwd_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  beginLoading();
  try {
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || res.statusText);
      (err as Error & { details?: unknown }).details = data;
      throw err;
    }
    return data as T;
  } finally {
    endLoading();
  }
}

export async function uploadApplicationDocument(applicationId: string, file: File, documentType: string) {
  const body = new FormData();
  body.append("file", file);
  body.append("documentType", documentType);
  return api<{ id: string; documentType: string }>(`/api/applications/${applicationId}/documents`, {
    method: "POST",
    body,
  });
}

export async function uploadMyStaffProfilePhoto(file: File) {
  const body = new FormData();
  body.append("photo", file);
  const token = getToken();
  beginLoading();
  try {
    const res = await fetch("/api/auth/profile-photo", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data as { photoPath: string };
  } finally {
    endLoading();
  }
}

export async function updateMyProfile(fullName: string) {
  return api<{ ok: boolean; fullName: string }>("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify({ fullName }),
  });
}

export async function pingStaffPresence() {
  return api<{ ok: boolean; at: string }>("/api/auth/presence", { method: "POST" });
}

export async function uploadApplicantPassportPhoto(
  applicantProfileId: string,
  file: File,
  options?: { forCaregiver?: boolean },
) {
  const body = new FormData();
  body.append("file", file);
  if (options?.forCaregiver) body.append("forCaregiver", "true");
  return api<{ photoPath: string }>(`/api/applicants/${applicantProfileId}/passport-photo`, {
    method: "POST",
    body,
  });
}

export function pesewasToGhs(v?: number | null) {
  if (v == null) return "—";
  return `GHS ${(v / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Support cycle year plus when the request was opened (from ISO timestamp). */
export function formatSupportYearWithDateTime(
  year: number | null | undefined,
  iso: string | null | undefined,
): string {
  const when = formatAppDateTimeFromIso(iso);
  if (year != null && when) return `${year} · ${when}`;
  if (year != null) return String(year);
  return when || "—";
}

/** Year on one line + short date/time on the next — for narrow table columns on mobile. */
export function formatSupportYearWithDateTimeMobileLines(
  year: number | null | undefined,
  iso: string | null | undefined,
): { line1: string; line2: string } {
  if (iso && year != null) {
    const stacked = formatAppHistoryYearStack(iso, year);
    if (stacked.whenLine) return { line1: stacked.yearLine, line2: stacked.whenLine };
  }
  const when = formatAppDateTimeFromIso(iso);
  if (when && year == null) return { line1: when, line2: "" };
  if (year != null) return { line1: String(year), line2: when };
  return { line1: when || "—", line2: "" };
}

export const STATUS_LABELS: Record<string, string> = {
  registration: "Registration",
  interview: "Interview",
  selection: "Selection",
  disbursement: "Disbursement",
  completed: "Completed",
  returned_for_correction: "Returned for Correction",
  rejected: "Rejected",
  partially_fulfilled: "Partially Disbursed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
  draft: "Registration",
  submitted: "Registration",
  under_verification: "Interview",
  under_assessment: "Interview",
  pending_decision: "Selection",
  escalated: "Selection",
  approved: "Selection",
  pending_fulfilment: "Disbursement",
  fulfilled: "Completed",
};

export type StatusKind = "success" | "warning" | "danger" | "info" | "neutral";

export function statusKind(status: string): StatusKind {
  if (["completed", "partially_fulfilled", "fulfilled"].includes(status)) return "success";
  if (["rejected", "cancelled"].includes(status)) return "danger";
  if (status === "registration" || status === "draft") return "neutral";
  if (status === "on_hold") return "info";
  return "warning";
}

export const STATUS_TONES: Record<StatusKind, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
  neutral: "bg-muted/10 text-muted",
};

export const CATEGORY_LABELS: Record<string, string> = {
  education: "Educational Support",
  health: "Health Support",
  income_generating: "Income Generating Activities",
  caregivers: "Caregivers Support",
  assistive_device: "Assistive Device",
};

export const PHASE_LABELS = ["Registration", "Interview", "Selection", "Disbursement", "Final"] as const;
