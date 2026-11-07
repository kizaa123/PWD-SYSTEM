import type { RegistrationSupportIntake } from "./registrationIntake";
import { ASSISTIVE_DEVICE_OPTIONS, type FormalLevel, type HealthNeed, type PurposeFormState } from "./supportPurposeOptions";

const HEALTH_NEED_LABEL: Record<HealthNeed, string> = {
  surgery: "Surgery",
  therapy: "Therapy",
  medication: "Medication",
};

export type IntakeDisplayRow = { label: string; value: string };

const SUPPORT_TYPE_LABEL: Record<string, string> = {
  education: "Education",
  economic_empowerment: "Economic empowerment",
  health: "Health",
  assistive_device: "Assistive device",
  other: "Other",
};

const FORMAL_LEVEL_LABEL: Record<FormalLevel, string> = {
  basic: "Basic",
  secondary: "Secondary",
  tertiary: "Tertiary",
};

function summaryLineMap(lines: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    map.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
  }
  return map;
}

function pushUnique(rows: IntakeDisplayRow[], label: string, value: string | null | undefined) {
  const v = value?.trim();
  if (!v) return;
  if (rows.some((r) => r.label === label && r.value === v)) return;
  rows.push({ label, value: v });
}

/** Human-readable rows for support captured at registration (apply form + modals). */
export function registrationIntakeDisplayRows(intake: RegistrationSupportIntake): IntakeDisplayRow[] {
  const rows: IntakeDisplayRow[] = [];
  const pf = intake.purposeForm as Partial<PurposeFormState>;
  const fromLines = summaryLineMap(intake.summaryLines);
  const st = intake.supportType || (intake.categoryCode !== "caregivers" ? intake.categoryCode : null);

  const categoryTitle =
    intake.categoryCode === "caregivers"
      ? "Caregiver support"
      : intake.categoryLabel || intake.categoryCode;
  pushUnique(rows, "Support category", categoryTitle);

  if (intake.categoryCode === "caregivers") {
    const purpose =
      pf.caregiverPurpose?.trim() ||
      fromLines.get("purpose") ||
      "";
    if (purpose) {
      const purposeDisplay =
        purpose === "Other"
          ? pf.caregiverPurposeOther?.trim() || fromLines.get("purpose")?.split("—").pop()?.trim() || "Other"
          : purpose.replace(/\s*—.*$/, "").trim();
      pushUnique(rows, "Primary purpose", purposeDisplay);
    }
    if (st) {
      pushUnique(rows, "Type of support", SUPPORT_TYPE_LABEL[st] || st);
    }
  }

  const effectiveType = st || intake.categoryCode;

  if (effectiveType === "education" || intake.categoryCode === "education") {
    const mode = fromLines.get("education mode");
    if (mode) pushUnique(rows, "Education mode", mode);
    const level = fromLines.get("level");
    if (level) pushUnique(rows, "Level", level);
    if (pf.educationTrack === "formal" && pf.formalLevel) {
      pushUnique(rows, "Level", FORMAL_LEVEL_LABEL[pf.formalLevel as FormalLevel]);
    }
    if (pf.educationTrack === "apprenticeship") {
      pushUnique(rows, "Education path", pf.apprenticeshipType === "technical" ? "Technical apprenticeship" : "Vocational apprenticeship");
    }
  }

  if (effectiveType === "economic_empowerment" || intake.categoryCode === "income_generating") {
    pushUnique(rows, "Business stage", fromLines.get("business") || pf.economicActivity);
    pushUnique(rows, "Economic activity", fromLines.get("activity") || pf.economicActivity);
    if (pf.incomeSupportType === "startup_tool") {
      pushUnique(rows, "Support form", "Start-up tool");
      pushUnique(rows, "Item", pf.itemSpecification);
    } else if (pf.incomeSupportType === "startup_capital") {
      pushUnique(rows, "Support form", "Start-up capital");
    }
  }

  if (effectiveType === "health" || intake.categoryCode === "health") {
    const health =
      fromLines.get("health") ||
      (pf.healthNeed ? HEALTH_NEED_LABEL[pf.healthNeed as HealthNeed] : "");
    pushUnique(rows, "Health need", health);
  }

  if (effectiveType === "assistive_device" || intake.categoryCode === "assistive_device") {
    const device =
      fromLines.get("device") ||
      ASSISTIVE_DEVICE_OPTIONS.find((o) => o.key === pf.assistiveDeviceType)?.label ||
      pf.assistiveDeviceOther;
    pushUnique(rows, "Assistive device", device);
  }

  const notes = fromLines.get("notes from registration") || fromLines.get("supporting info");
  if (notes) pushUnique(rows, "Additional notes", notes);

  if (rows.length <= 1 && intake.summaryLines.length > 0) {
    for (const line of intake.summaryLines) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      pushUnique(rows, line.slice(0, idx).trim(), line.slice(idx + 1).trim());
    }
  }

  return rows;
}

/** Labels that carry the actual thing the applicant asked for, most specific first. */
/** Caregiver "Primary purpose" (basic needs, treatments context) is not DACF support requested. */
const REQUESTED_NEED_LABELS = [
  "Health need",
  "Assistive device",
  "Item",
  "Support form",
  "Level",
  "Education path",
  "Economic activity",
  "Business stage",
];

/**
 * Collapses the registration intake to what a first-time application needs to show:
 * the support category that was selected and the need that was requested.
 */
export function registrationIntakeRequestRows(intake: RegistrationSupportIntake): IntakeDisplayRow[] {
  const rows = registrationIntakeDisplayRows(intake);
  const value = (label: string) => rows.find((r) => r.label === label)?.value;

  // The category is the kind of help requested (Health, Education, …). "Caregivers" and
  // "PWD" are registration types, not support categories.
  const category =
    value("Type of support") ||
    (intake.supportType ? SUPPORT_TYPE_LABEL[intake.supportType] || intake.supportType : "") ||
    (intake.categoryCode === "caregivers" ? "" : value("Support category")) ||
    (intake.categoryCode === "caregivers" ? "" : intake.categoryLabel) ||
    (intake.categoryCode === "caregivers" ? "" : intake.categoryCode);
  const need = REQUESTED_NEED_LABELS.map(value).find((v) => Boolean(v) && v !== category);

  const out: IntakeDisplayRow[] = [{ label: "Support category", value: category || "—" }];
  if (need) out.push({ label: "Support requested", value: need });
  return out;
}
