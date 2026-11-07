/** Maps a saved yearly request into the two-line category + need summary. */

import { caregiverApplicationSupportDisplay } from "./caregiverSupportDisplay";

export type SupportDisplayRow = { label: string; value: string };

function field(details: Record<string, unknown> | null | undefined, ...keys: string[]): string {
  if (!details) return "";
  for (const key of keys) {
    const v = details[key];
    if (v != null && String(v).trim() && String(v) !== "0") return String(v).trim();
  }
  return "";
}

function healthNeedLabel(purpose: string): string {
  const p = purpose.toLowerCase();
  if (p.includes("medication")) return "Medication";
  if (p.includes("therapy")) return "Therapy";
  if (p.includes("surgery")) return "Surgery";
  return purpose;
}

/**
 * The category is the kind of help (Health, Education, …). The requested line is
 * the specific need on that application (Surgery, Wheelchair, Basic Needs, …).
 */
export function applicationSupportRequestRows(
  categoryCode: string,
  categoryName: string,
  details: Record<string, unknown> | null | undefined,
  purposeSummary?: string | null,
): SupportDisplayRow[] {
  if (categoryCode === "caregivers") {
    const parsed = caregiverApplicationSupportDisplay(details, purposeSummary);
    const category = parsed.category || "—";
    const rows: SupportDisplayRow[] = [{ label: "Support category", value: category }];
    if (parsed.requested) rows.push({ label: "Support requested", value: parsed.requested });
    return rows;
  }

  const category = categoryName?.trim() || categoryCode || "—";
  let requested = "";

  if (categoryCode === "health") {
    requested = healthNeedLabel(field(details, "health_purpose", "healthPurpose"));
  } else if (categoryCode === "assistive_device") {
    requested =
      field(details, "assistive_device_type", "assistiveDeviceType") ||
      field(details, "assistive_device_key", "assistiveDeviceKey");
  } else if (categoryCode === "education") {
    const mode = field(details, "education_mode", "educationMode");
    const level = field(details, "education_level", "educationLevel", "qualification_pursued", "qualificationPursued");
    const support = field(details, "support_type", "supportType");
    const apprenticeship = field(details, "apprenticeship_type", "apprenticeshipType");
    requested = [mode, level || apprenticeship, support].filter(Boolean).join(" — ");
  } else if (categoryCode === "income_generating") {
    const kind =
      field(details, "subtype") === "startup_tool" ? "Start-up tool" : field(details, "subtype") ? "Start-up capital" : "";
    const activity = field(details, "business_activity", "businessActivity");
    const item = field(details, "item_specification", "itemSpecification");
    requested = [kind, activity, item].filter(Boolean).join(" — ");
  }

  if (!requested && purposeSummary?.trim() && categoryCode !== "caregivers") {
    const parts = purposeSummary.split("—").map((p) => p.trim()).filter(Boolean);
    requested = parts.slice(1).join(" — ");
  }

  const rows: SupportDisplayRow[] = [{ label: "Support category", value: category || "—" }];
  if (requested) rows.push({ label: "Support requested", value: requested });
  return rows;
}
