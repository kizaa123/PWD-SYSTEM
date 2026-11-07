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

export function listAssistiveDeviceHistory(applicantProfileId: string): AssistiveDeviceHistoryRow[] {
  return all<AssistiveDeviceHistoryRow>(
    `SELECT a.id, a.reference, a.application_year, a.status, a.created_at,
            hd.assistive_device_key, hd.assistive_device_type
     FROM applications a
     INNER JOIN health_details hd ON hd.application_id = a.id
     WHERE a.applicant_profile_id = ? AND a.category_code = 'assistive_device'
       AND a.status NOT IN ('rejected', 'cancelled')
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
    return "This device has been applied for already.";
  }
  return null;
}

export function validateAssistiveDeviceDetails(details: Record<string, unknown>): string | null {
  const key = details.assistiveDeviceKey != null ? String(details.assistiveDeviceKey).trim() : "";
  if (!key) return "Select exactly one assistive device type.";
  const typeLabel = details.assistiveDeviceType != null ? String(details.assistiveDeviceType).trim() : "";
  if (!typeLabel) return "Assistive device type label is required.";
  if (key === "other") {
    const other = details.healthPurposeOther != null ? String(details.healthPurposeOther).trim() : "";
    if (!other) return "Specify the other assistive device type.";
  }
  return null;
}
