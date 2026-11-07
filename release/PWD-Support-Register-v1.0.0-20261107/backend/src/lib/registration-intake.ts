/** Support category + purpose captured at registration — reused on first yearly apply. */

const DEVICE_LABEL_TO_KEY: Record<string, string> = {
  laptop: "laptop",
  wheelchair: "wheelchair",
  "hearing aid": "hearing_aid",
  "white cain": "white_cain",
  dictator: "dictator",
  "braille notes-taker": "braille_notes_taker",
  recorder: "recorder",
  "accessible mobile phone": "accessible_mobile_phone",
};

function formalLevelFromRegistration(level: string): string {
  const v = level.trim().toLowerCase();
  if (v.includes("basic")) return "basic";
  if (v.includes("secondary")) return "secondary";
  if (v.includes("university") || v.includes("tertiary")) return "tertiary";
  return "";
}

function healthNeedFromRegistration(purpose: string): string {
  const p = purpose.toLowerCase();
  if (p.includes("medication")) return "medication";
  if (p.includes("therapy")) return "therapy";
  if (p.includes("surgery")) return "surgery";
  return "";
}

function deviceKeyFromRegistration(label: string): string {
  if (!label?.trim()) return "";
  if (label.trim().toLowerCase() === "other") return "other";
  const key = DEVICE_LABEL_TO_KEY[label.trim().toLowerCase()];
  return key || "other";
}

function supportTypeLabel(code: string): string {
  const map: Record<string, string> = {
    education: "Education",
    economic_empowerment: "Economic Empowerment",
    health: "Health",
    assistive_device: "Assistive Device",
    other: "Other",
  };
  return map[code] || code;
}

export type RegistrationSupportIntake = {
  version: 1;
  registrationType: "pwd" | "caregiver";
  categoryCode: string;
  categoryLabel: string;
  supportType: string | null;
  purposeForm: Record<string, unknown>;
  applicationDetails: Record<string, unknown>;
  summaryLines: string[];
  purposeSummarySeed: string;
};

export function buildRegistrationSupportIntake(
  registrationType: "pwd" | "caregiver",
  categoryCode: string,
  b: Record<string, unknown>,
  applicationDetails: Record<string, unknown>,
  purposeSummarySeed: string,
): RegistrationSupportIntake {
  const supportType = String(b.supportType || "") || null;
  const summaryLines: string[] = [];
  const categoryLabel =
    categoryCode === "caregivers"
      ? "Caregivers"
      : categoryCode === "income_generating"
        ? "Income Generating Activities"
        : supportTypeLabel(supportType || categoryCode);

  summaryLines.push(`Category: ${categoryLabel}`);
  if (registrationType === "caregiver" && b.caregiverPurpose) {
    summaryLines.push(
      `Purpose: ${b.caregiverPurpose}${b.caregiverPurpose === "Other" && b.caregiverPurposeOther ? ` — ${b.caregiverPurposeOther}` : ""}`,
    );
  }
  if (supportType) summaryLines.push(`Type of support: ${supportTypeLabel(supportType)}`);

  const purposeForm: Record<string, unknown> = {};

  if (categoryCode === "caregivers") {
    purposeForm.caregiverPurpose = String(b.caregiverPurpose || "");
    purposeForm.caregiverPurposeOther =
      b.caregiverPurpose === "Other"
        ? String(b.caregiverPurposeOther || "")
        : String(b.supportingInfo || b.caregiverPurposeOther || "");
  } else if (categoryCode === "education") {
    const informal = b.educationMode === "Informal";
    purposeForm.educationTrack = informal ? "apprenticeship" : "formal";
    if (informal) {
      purposeForm.apprenticeshipType =
        String(b.apprenticeshipType || "").toLowerCase().includes("technical") ? "technical" : "vocational";
      purposeForm.educationalSupportType = "school_fees";
    } else {
      purposeForm.formalLevel = formalLevelFromRegistration(String(b.educationLevelFormal || ""));
      purposeForm.educationalSupportType = "school_fees";
    }
  } else if (categoryCode === "income_generating") {
    purposeForm.economicActivity = String(b.businessActivity || b.supportTypeOther || "");
    purposeForm.incomeSupportType =
      b.businessStage === "Business Expansion" ? "startup_capital" : "startup_capital";
  } else if (categoryCode === "health") {
    purposeForm.healthNeed = healthNeedFromRegistration(String(b.healthPurpose || ""));
  } else if (categoryCode === "assistive_device") {
    const deviceLabel = b.assistiveDeviceType === "Other" ? "Other" : String(b.assistiveDeviceType || "");
    purposeForm.assistiveDeviceType = deviceKeyFromRegistration(deviceLabel);
    purposeForm.assistiveDeviceOther =
      b.assistiveDeviceType === "Other" ? String(b.assistiveDeviceOther || "") : "";
    purposeForm.alreadyReceivingAssistive = b.alreadyReceivingAssistive === "yes" ? "yes" : "no";
    purposeForm.existingAssistiveDetail = String(b.existingAssistiveDetail || "");
    purposeForm.prescribedWhere = String(b.prescribedWhere || "");
  }

  if (supportType === "education" && categoryCode === "caregivers") {
    if (b.educationMode) summaryLines.push(`Education mode: ${b.educationMode}`);
    if (b.educationLevelFormal) summaryLines.push(`Level: ${b.educationLevelFormal}`);
  }
  if (supportType === "economic_empowerment") {
    if (b.businessStage) summaryLines.push(`Business: ${b.businessStage}`);
    if (b.businessActivity) summaryLines.push(`Activity: ${b.businessActivity}`);
  }
  if (supportType === "health" && b.healthPurpose) summaryLines.push(`Health: ${b.healthPurpose}`);
  if (supportType === "assistive_device" && b.assistiveDeviceType) {
    summaryLines.push(`Device: ${b.assistiveDeviceType}`);
  }
  if (b.supportingInfo) summaryLines.push(`Notes from registration: ${b.supportingInfo}`);

  return {
    version: 1,
    registrationType,
    categoryCode,
    categoryLabel,
    supportType,
    purposeForm,
    applicationDetails,
    summaryLines,
    purposeSummarySeed,
  };
}

export function parseRegistrationSupportIntake(raw: unknown): RegistrationSupportIntake | null {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as RegistrationSupportIntake;
    if (parsed?.version !== 1 || !parsed.categoryCode) return null;
    return parsed;
  } catch {
    return null;
  }
}
