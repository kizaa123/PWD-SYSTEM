/** Structured DACF “Type of support” fields per support category. */

export type IncomeSupportType = "startup_capital" | "startup_tool";
export type EducationTrack = "formal" | "apprenticeship";
export type FormalLevel = "basic" | "secondary" | "tertiary";
export type ApprenticeshipType = "vocational" | "technical";
export type EducationalSupportType = "school_fees" | "bursary" | "technical_aid";
export type HealthNeed = "assistive_device" | "medication" | "surgery" | "therapy";

export type AssistiveDeviceKey =
  | "laptop"
  | "wheelchair"
  | "hearing_aid"
  | "white_cain"
  | "dictator"
  | "braille_notes_taker"
  | "recorder"
  | "accessible_mobile_phone"
  | "other";

export type PurposeFormState = {
  economicActivity: string;
  incomeSupportType: IncomeSupportType | "";
  itemSpecification: string;
  educationTrack: EducationTrack | "";
  formalLevel: FormalLevel | "";
  qualificationPursued: string;
  apprenticeshipType: ApprenticeshipType | "";
  educationalSupportType: EducationalSupportType | "";
  healthNeed: HealthNeed | "";
  assistiveDeviceType: AssistiveDeviceKey | "";
  assistiveDeviceOther: string;
  alreadyReceivingAssistive: "" | "yes" | "no";
  existingAssistiveDetail: string;
  prescribedWhere: string;
  caregiverPurpose: string;
  caregiverPurposeOther: string;
  schoolName: string;
  schoolAccountNumber: string;
};

export const EMPTY_PURPOSE_FORM: PurposeFormState = {
  economicActivity: "",
  incomeSupportType: "",
  itemSpecification: "",
  educationTrack: "",
  formalLevel: "",
  qualificationPursued: "",
  apprenticeshipType: "",
  educationalSupportType: "",
  healthNeed: "",
  assistiveDeviceType: "",
  assistiveDeviceOther: "",
  alreadyReceivingAssistive: "",
  existingAssistiveDetail: "",
  prescribedWhere: "",
  caregiverPurpose: "",
  caregiverPurposeOther: "",
  schoolName: "",
  schoolAccountNumber: "",
};

/** Full checklist (historical / legacy records). */
export const ASSISTIVE_DEVICE_OPTIONS: { key: AssistiveDeviceKey; label: string }[] = [
  { key: "laptop", label: "Laptop" },
  { key: "wheelchair", label: "Wheelchair" },
  { key: "hearing_aid", label: "Hearing Aid" },
  { key: "white_cain", label: "White Cain" },
  { key: "dictator", label: "Dictator" },
  { key: "braille_notes_taker", label: "Braille Notes-taker" },
  { key: "recorder", label: "Recorder" },
  { key: "accessible_mobile_phone", label: "Accessible mobile phone" },
  { key: "other", label: "Other" },
];

/** Education — technical aid devices only. */
export const EDUCATION_TECHNICAL_AID_OPTIONS: { key: AssistiveDeviceKey; label: string }[] = [
  { key: "laptop", label: "Laptop" },
  { key: "recorder", label: "Recorder" },
  { key: "accessible_mobile_phone", label: "Accessible mobile phone" },
  { key: "braille_notes_taker", label: "Braille Notes-taker" },
  { key: "other", label: "Other" },
];

/** Health — mobility and sensory assistive devices. */
export const HEALTH_ASSISTIVE_DEVICE_OPTIONS: { key: AssistiveDeviceKey; label: string }[] = [
  { key: "wheelchair", label: "Wheelchair" },
  { key: "hearing_aid", label: "Hearing Aid" },
  { key: "white_cain", label: "White Cain" },
  { key: "dictator", label: "Dictator" },
  { key: "braille_notes_taker", label: "Braille Notes-taker" },
  { key: "other", label: "Other" },
];

/** Income — start-up tools (includes some devices plus custom equipment via Other). */
export const STARTUP_TOOL_DEVICE_OPTIONS: { key: AssistiveDeviceKey; label: string }[] = [
  { key: "laptop", label: "Laptop" },
  { key: "recorder", label: "Recorder" },
  { key: "accessible_mobile_phone", label: "Accessible mobile phone" },
  { key: "wheelchair", label: "Wheelchair" },
  { key: "hearing_aid", label: "Hearing Aid" },
  { key: "other", label: "Other" },
];

export const CAREGIVER_PURPOSE_OPTIONS = [
  "Treatments of person receiving care",
  "Basic Needs",
  "Utility Bills",
  "House Rent",
  "Other",
] as const;

const FORMAL_LEVEL_LABEL: Record<FormalLevel, string> = {
  basic: "Basic",
  secondary: "Secondary",
  tertiary: "Tertiary",
};

const EDUCATIONAL_SUPPORT_LABEL: Record<EducationalSupportType, string> = {
  school_fees: "School fees",
  bursary: "Bursary",
  technical_aid: "Technical aid",
};

const HEALTH_NEED_LABEL: Record<HealthNeed, string> = {
  assistive_device: "Assistive device",
  medication: "Medication",
  surgery: "Surgery",
  therapy: "Therapy",
};

const INCOME_SUPPORT_LABEL: Record<IncomeSupportType, string> = {
  startup_capital: "Capital",
  startup_tool: "Start-up tool",
};

export function assistiveDeviceKeyFromHistoryRow(row: {
  assistive_device_key: string | null;
  assistive_device_type: string | null;
}): AssistiveDeviceKey | null {
  const raw = row.assistive_device_key?.trim();
  if (raw && ASSISTIVE_DEVICE_OPTIONS.some((o) => o.key === raw)) {
    return raw as AssistiveDeviceKey;
  }
  const type = row.assistive_device_type?.trim();
  if (!type) return null;
  const exact = ASSISTIVE_DEVICE_OPTIONS.find((o) => o.label === type);
  if (exact) return exact.key;
  const loose = ASSISTIVE_DEVICE_OPTIONS.find((o) => type.includes(o.label));
  return loose?.key ?? null;
}

export function assistiveDeviceKeysFromHistory(
  history: { assistive_device_key: string | null; assistive_device_type: string | null }[],
): AssistiveDeviceKey[] {
  const keys = new Set<AssistiveDeviceKey>();
  for (const row of history) {
    const key = assistiveDeviceKeyFromHistoryRow(row);
    if (key) keys.add(key);
  }
  return [...keys];
}

export function assistiveDeviceLabelForKey(key: AssistiveDeviceKey | "", otherText?: string): string {
  if (!key) return "";
  if (key === "other") return otherText?.trim() || "Other";
  return ASSISTIVE_DEVICE_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

export function assistiveDeviceKeyFromPurposeForm(categoryCode: string, form: PurposeFormState): AssistiveDeviceKey | "" {
  if (categoryCode === "education" && form.educationalSupportType === "technical_aid") {
    return form.assistiveDeviceType;
  }
  if (categoryCode === "health" && form.healthNeed === "assistive_device") {
    return form.assistiveDeviceType;
  }
  return "";
}

function assistiveDeviceTypeSummary(form: PurposeFormState): string {
  return assistiveDeviceLabelForKey(form.assistiveDeviceType, form.assistiveDeviceOther);
}

export function purposeFormForCategory(_categoryCode: string): PurposeFormState {
  return { ...EMPTY_PURPOSE_FORM };
}

export function validatePurposeForm(categoryCode: string, form: PurposeFormState): string | null {
  switch (categoryCode) {
    case "income_generating": {
      if (!form.economicActivity.trim()) return "Enter the type of economic activity.";
      if (!form.incomeSupportType) return "Select Capital or Start-up tool.";
      if (form.incomeSupportType === "startup_capital" && !form.itemSpecification.trim()) {
        return "State what the capital will be used for.";
      }
      if (form.incomeSupportType === "startup_tool" && !form.itemSpecification.trim()) {
        return "Specify the start-up tool or equipment needed.";
      }
      return null;
    }
    case "education": {
      if (!form.educationTrack) return "Select formal education or apprenticeship.";
      if (form.educationTrack === "formal") {
        if (!form.formalLevel) return "Select Basic, Secondary, or Tertiary.";
        if (form.formalLevel === "tertiary" && !form.qualificationPursued.trim()) {
          return "Specify the type of qualification being pursued.";
        }
      } else {
        if (!form.apprenticeshipType) return "Select Vocational or Technical apprenticeship.";
      }
      if (!form.educationalSupportType) return "Select the type of educational support.";
      if (form.educationalSupportType === "technical_aid") {
        if (!form.assistiveDeviceType) return "Select the technical aid device needed.";
        if (form.assistiveDeviceType === "other" && !form.assistiveDeviceOther.trim()) {
          return "Specify the education device needed.";
        }
      }
      return null;
    }
    case "health": {
      if (!form.healthNeed) return "Select Assistive device, Medication, Surgery, or Therapy.";
      if (form.healthNeed === "assistive_device") {
        if (!form.assistiveDeviceType) return "Select or specify the assistive device needed.";
        if (form.assistiveDeviceType === "other" && !form.assistiveDeviceOther.trim()) {
          return "State the specific device (e.g. wheelchair).";
        }
      }
      return null;
    }
    case "assistive_device": {
      if (!form.assistiveDeviceType) {
        return "Select one assistive device to request for this year.";
      }
      if (form.assistiveDeviceType === "other" && !form.assistiveDeviceOther.trim()) {
        return "Specify the other assistive device type.";
      }
      if (!form.alreadyReceivingAssistive) {
        return "Indicate whether the applicant is already receiving assistive support.";
      }
      if (form.alreadyReceivingAssistive === "yes") {
        if (!form.existingAssistiveDetail.trim()) return "Specify the assistive support already being received.";
        if (!form.prescribedWhere.trim()) return "State where the existing support was prescribed.";
      }
      return null;
    }
    case "caregivers": {
      if (!form.caregiverPurpose) return "Select the purpose of caregiver support.";
      if (form.caregiverPurpose === "Other" && !form.caregiverPurposeOther.trim()) {
        return "Specify the caregiver support purpose.";
      }
      return null;
    }
    default:
      return null;
  }
}

export function buildDetailsFromPurposeForm(categoryCode: string, form: PurposeFormState): Record<string, unknown> {
  const deviceKey = assistiveDeviceKeyFromPurposeForm(categoryCode, form);
  const deviceLabel = deviceKey ? assistiveDeviceLabelForKey(deviceKey, form.assistiveDeviceOther) : null;

  switch (categoryCode) {
    case "income_generating": {
      const type = form.incomeSupportType;
      const subtype = type === "startup_tool" ? "startup_tool" : "startup_capital";
      return {
        subtype,
        businessActivity: form.economicActivity.trim(),
        itemSpecification:
          type === "startup_capital" || type === "startup_tool"
            ? form.itemSpecification.trim() || null
            : null,
      };
    }
    case "education": {
      const isApprenticeship = form.educationTrack === "apprenticeship";
      return {
        educationMode: isApprenticeship ? "Informal" : "Formal",
        educationLevel: isApprenticeship ? null : FORMAL_LEVEL_LABEL[form.formalLevel as FormalLevel],
        apprenticeshipType: isApprenticeship
          ? form.apprenticeshipType === "technical"
            ? "Technical"
            : "Vocational"
          : null,
        qualificationPursued:
          form.formalLevel === "tertiary" ? form.qualificationPursued.trim() || null : null,
        supportType: EDUCATIONAL_SUPPORT_LABEL[form.educationalSupportType as EducationalSupportType],
        schoolName: form.schoolName.trim() || null,
        schoolAccountNumber: form.schoolAccountNumber.trim() || null,
        assistiveDeviceKey:
          form.educationalSupportType === "technical_aid" ? deviceKey || null : null,
        assistiveDeviceType:
          form.educationalSupportType === "technical_aid" ? deviceLabel : null,
        deviceOther:
          form.educationalSupportType === "technical_aid" && form.assistiveDeviceType === "other"
            ? form.assistiveDeviceOther.trim() || null
            : null,
      };
    }
    case "health": {
      if (form.healthNeed === "medication") {
        return { healthPurpose: "For medication" };
      }
      if (form.healthNeed === "therapy") {
        return { healthPurpose: "For Therapy" };
      }
      if (form.healthNeed === "surgery") {
        return { healthPurpose: "Surgery" };
      }
      if (form.healthNeed === "assistive_device") {
        return {
          healthPurpose: "Assistive device",
          assistiveDeviceKey: deviceKey || null,
          assistiveDeviceType: deviceLabel || null,
          healthPurposeOther: form.assistiveDeviceType === "other" ? form.assistiveDeviceOther.trim() || null : null,
        };
      }
      return {};
    }
    case "assistive_device": {
      const key = form.assistiveDeviceType;
      const label = assistiveDeviceLabelForKey(key, form.assistiveDeviceOther);
      return {
        healthPurpose: "Assistive device",
        assistiveDeviceKey: key || null,
        assistiveDeviceType: label || null,
        healthPurposeOther: key === "other" ? form.assistiveDeviceOther.trim() || null : null,
        alreadyReceivingAssistive: form.alreadyReceivingAssistive === "yes",
        existingAssistiveDetail:
          form.alreadyReceivingAssistive === "yes" ? form.existingAssistiveDetail.trim() || null : null,
        prescribedWhere: form.alreadyReceivingAssistive === "yes" ? form.prescribedWhere.trim() || null : null,
      };
    }
    case "caregivers":
      return {
        purpose: form.caregiverPurpose,
        purposeOther: form.caregiverPurpose === "Other" ? form.caregiverPurposeOther.trim() : null,
      };
    default:
      return {};
  }
}

export function buildPurposeSummaryFromForm(
  categoryCode: string,
  categoryLabel: string,
  form: PurposeFormState,
): string {
  const parts: string[] = [categoryLabel];
  switch (categoryCode) {
    case "income_generating": {
      if (form.incomeSupportType) parts.push(INCOME_SUPPORT_LABEL[form.incomeSupportType]);
      if (form.economicActivity.trim()) parts.push(form.economicActivity.trim());
      if (form.incomeSupportType === "startup_capital" && form.itemSpecification.trim()) {
        parts.push(form.itemSpecification.trim());
      }
      if (form.incomeSupportType === "startup_tool" && form.itemSpecification.trim()) {
        parts.push(form.itemSpecification.trim());
      }
      break;
    }
    case "education": {
      if (form.educationTrack === "apprenticeship") {
        parts.push(
          `Apprenticeship — ${form.apprenticeshipType === "technical" ? "Technical" : "Vocational"}`,
        );
      } else if (form.formalLevel) {
        parts.push(FORMAL_LEVEL_LABEL[form.formalLevel]);
        if (form.formalLevel === "tertiary" && form.qualificationPursued.trim()) {
          parts.push(form.qualificationPursued.trim());
        }
      }
      if (form.educationalSupportType) {
        parts.push(EDUCATIONAL_SUPPORT_LABEL[form.educationalSupportType]);
      }
      if (form.educationalSupportType === "technical_aid") {
        const devices = assistiveDeviceTypeSummary(form);
        if (devices) parts.push(devices);
      }
      break;
    }
    case "health":
      if (form.healthNeed === "assistive_device") {
        parts.push("Assistive device");
        const devices = assistiveDeviceTypeSummary(form);
        if (devices) parts.push(devices);
      } else if (form.healthNeed) {
        parts.push(HEALTH_NEED_LABEL[form.healthNeed]);
      }
      break;
    case "assistive_device": {
      const devices = assistiveDeviceTypeSummary(form);
      if (devices) parts.push(devices);
      break;
    }
    case "caregivers":
      parts.push(
        form.caregiverPurpose === "Other"
          ? form.caregiverPurposeOther.trim() || "Other"
          : form.caregiverPurpose,
      );
      break;
  }
  return parts.filter(Boolean).join(" — ");
}

export type PrintRow = { label: string; value: string };

export function applicationPurposePrintRows(categoryCode: string, form: PurposeFormState): PrintRow[] {
  const rows: PrintRow[] = [];
  switch (categoryCode) {
    case "income_generating":
      rows.push({ label: "Type of economic activity", value: form.economicActivity.trim() || "—" });
      rows.push({
        label: "Type of support",
        value: form.incomeSupportType ? INCOME_SUPPORT_LABEL[form.incomeSupportType] : "—",
      });
      if (form.incomeSupportType === "startup_capital" && form.itemSpecification.trim()) {
        rows.push({ label: "Capital use", value: form.itemSpecification.trim() });
      }
      if (form.incomeSupportType === "startup_tool") {
        rows.push({ label: "Start-up tool", value: form.itemSpecification.trim() || "—" });
      }
      break;
    case "education":
      rows.push({
        label: "Level or apprenticeship",
        value: form.educationTrack === "apprenticeship" ? "Apprenticeship" : form.educationTrack === "formal" ? "Formal" : "—",
      });
      if (form.educationTrack === "formal") {
        rows.push({ label: "Education level", value: FORMAL_LEVEL_LABEL[form.formalLevel as FormalLevel] || "—" });
        if (form.formalLevel === "tertiary") {
          rows.push({ label: "Qualification pursued", value: form.qualificationPursued.trim() || "—" });
        }
      }
      if (form.educationTrack === "apprenticeship") {
        rows.push({
          label: "Apprenticeship type",
          value: form.apprenticeshipType === "technical" ? "Technical" : form.apprenticeshipType === "vocational" ? "Vocational" : "—",
        });
      }
      rows.push({
        label: "Type of educational support",
        value: form.educationalSupportType
          ? EDUCATIONAL_SUPPORT_LABEL[form.educationalSupportType as EducationalSupportType]
          : "—",
      });
      if (form.educationalSupportType === "technical_aid") {
        rows.push({ label: "Technical aid device", value: assistiveDeviceTypeSummary(form) || "—" });
      }
      if (form.schoolName.trim()) rows.push({ label: "School name", value: form.schoolName.trim() });
      if (form.schoolAccountNumber.trim()) {
        rows.push({ label: "School account No.", value: form.schoolAccountNumber.trim() });
      }
      break;
    case "health":
      rows.push({
        label: "Type of support",
        value: form.healthNeed ? HEALTH_NEED_LABEL[form.healthNeed] : "—",
      });
      if (form.healthNeed === "assistive_device") {
        rows.push({ label: "Device requested", value: assistiveDeviceTypeSummary(form) || "—" });
      }
      break;
    case "assistive_device":
      rows.push({
        label: "Device requested",
        value: assistiveDeviceTypeSummary(form) || "—",
      });
      rows.push({
        label: "Already receiving assistive support",
        value: form.alreadyReceivingAssistive === "yes" ? "Yes" : form.alreadyReceivingAssistive === "no" ? "No" : "—",
      });
      if (form.alreadyReceivingAssistive === "yes") {
        rows.push({ label: "Existing support specified", value: form.existingAssistiveDetail.trim() || "—" });
        rows.push({ label: "Where prescribed", value: form.prescribedWhere.trim() || "—" });
      }
      break;
    case "caregivers":
      rows.push({
        label: "Purpose of support",
        value:
          form.caregiverPurpose === "Other"
            ? form.caregiverPurposeOther.trim() || "Other"
            : form.caregiverPurpose || "—",
      });
      break;
  }
  return rows;
}

/** Only these three categories appear on the yearly application form. */
export const APPLICATION_PURPOSE_CATEGORY_ORDER = ["income_generating", "education", "health"] as const;
