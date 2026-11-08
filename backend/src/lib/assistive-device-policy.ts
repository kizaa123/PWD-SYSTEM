import { all, get } from "../db/index.ts";

export type AssistiveDeviceHistoryRow = {
  id: string;
  reference: string;
  application_year: number;
  status: string;
  created_at: string;
  assistive_device_key: string | null;
  assistive_device_type: string | null;
};

/** Device requests across education (technical aid), health, and legacy assistive category. */
export function listAssistiveDeviceHistory(applicantProfileId: string): AssistiveDeviceHistoryRow[] {
  return all<AssistiveDeviceHistoryRow>(
    `SELECT a.id, a.reference, a.application_year, a.status, a.created_at,
            COALESCE(hd.assistive_device_key, ed.device_key) AS assistive_device_key,
            COALESCE(
              NULLIF(TRIM(hd.assistive_device_type), ''),
              NULLIF(TRIM(ed.device_type), '')
            ) AS assistive_device_type
     FROM applications a
     LEFT JOIN health_details hd ON hd.application_id = a.id
       AND (a.category_code IN ('health', 'assistive_device') AND hd.assistive_device_key IS NOT NULL)
     LEFT JOIN education_details ed ON ed.application_id = a.id AND ed.device_key IS NOT NULL
     WHERE a.applicant_profile_id = ?
       AND a.status NOT IN ('rejected', 'cancelled')
       AND (hd.application_id IS NOT NULL OR ed.application_id IS NOT NULL)
     ORDER BY a.application_year DESC, a.created_at DESC`,
    [applicantProfileId],
  );
}

export function assistiveDeviceRequestForYear(applicantProfileId: string, year: number) {
  return get<{ id: string; reference: string; status: string }>(
    `SELECT a.id, a.reference, a.status
     FROM applications a
     WHERE a.applicant_profile_id = ? AND a.category_code = 'assistive_device' AND a.application_year = ?
       AND a.status NOT IN ('rejected', 'cancelled')`,
    [applicantProfileId, year],
  );
}

const DEVICE_KEYS = [
  "laptop",
  "wheelchair",
  "hearing_aid",
  "white_cain",
  "dictator",
  "braille_notes_taker",
  "recorder",
  "accessible_mobile_phone",
  "other",
] as const;

const DEVICE_LABELS: Record<string, string> = {
  laptop: "Laptop",
  wheelchair: "Wheelchair",
  hearing_aid: "Hearing Aid",
  white_cain: "White Cain",
  dictator: "Dictator",
  braille_notes_taker: "Braille Notes-taker",
  recorder: "Recorder",
  accessible_mobile_phone: "Accessible mobile phone",
  other: "Other",
};

function keyFromHistoryRow(row: AssistiveDeviceHistoryRow): string | null {
  const raw = row.assistive_device_key?.trim();
  if (raw && DEVICE_KEYS.includes(raw as (typeof DEVICE_KEYS)[number])) return raw;
  const type = row.assistive_device_type?.trim();
  if (!type) return null;
  for (const [key, label] of Object.entries(DEVICE_LABELS)) {
    if (type === label || type.includes(label)) return key;
  }
  return null;
}

export function assistiveDeviceKeysFromHistory(history: AssistiveDeviceHistoryRow[]): string[] {
  const keys = new Set<string>();
  for (const row of history) {
    const key = keyFromHistoryRow(row);
    if (key) keys.add(key);
  }
  return [...keys];
}

export function validateAssistiveDeviceNotPreviouslyApplied(
  applicantProfileId: string,
  deviceKey: string,
  excludeApplicationId?: string,
): string | null {
  if (!deviceKey) return "Select exactly one assistive device type.";
  const history = listAssistiveDeviceHistory(applicantProfileId).filter(
    (row) => row.id !== excludeApplicationId,
  );
  const applied = assistiveDeviceKeysFromHistory(history);
  if (applied.includes(deviceKey)) {
    return "This device has been requested before and cannot be applied for again.";
  }
  return null;
}

export function validateAssistiveDeviceDetails(details: Record<string, unknown>): string | null {
  const key = details.assistiveDeviceKey != null ? String(details.assistiveDeviceKey).trim() : "";
  if (!key) return "Select exactly one assistive device type.";
  const typeLabel = details.assistiveDeviceType != null ? String(details.assistiveDeviceType).trim() : "";
  if (!typeLabel && key !== "other") return "Assistive device type label is required.";
  if (key === "other") {
    const other =
      details.healthPurposeOther != null
        ? String(details.healthPurposeOther).trim()
        : details.deviceOther != null
          ? String(details.deviceOther).trim()
          : "";
    if (!other) return "Specify the other device type.";
  }
  return null;
}

/** When application details include a device key, validate selection and repeat rules. */
export function validateDeviceRequestInDetails(
  applicantProfileId: string,
  details: Record<string, unknown>,
  excludeApplicationId?: string,
): string | null {
  const key = details.assistiveDeviceKey != null ? String(details.assistiveDeviceKey).trim() : "";
  if (!key) return null;
  const detailErr = validateAssistiveDeviceDetails(details);
  if (detailErr) return detailErr;
  return validateAssistiveDeviceNotPreviouslyApplied(applicantProfileId, key, excludeApplicationId);
}
