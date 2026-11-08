import { all } from "../db/index.ts";

export type StartupToolHistoryRow = {
  id: string;
  reference: string;
  application_year: number;
  status: string;
  created_at: string;
  tool_name: string;
};

export function normalizeStartupToolName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function listStartupToolHistory(applicantProfileId: string): StartupToolHistoryRow[] {
  return all<StartupToolHistoryRow>(
    `SELECT a.id, a.reference, a.application_year, a.status, a.created_at,
            COALESCE(
              NULLIF(TRIM(iad.item_specification), ''),
              NULLIF(TRIM(iad.device_type), ''),
              'Start-up tool'
            ) AS tool_name
     FROM applications a
     INNER JOIN income_activity_details iad ON iad.application_id = a.id
     WHERE a.applicant_profile_id = ?
       AND a.category_code = 'income_generating'
       AND iad.subtype = 'startup_tool'
       AND a.status NOT IN ('rejected', 'cancelled')
       AND COALESCE(NULLIF(TRIM(iad.item_specification), ''), NULLIF(TRIM(iad.device_type), '')) IS NOT NULL
     ORDER BY a.application_year DESC, a.created_at DESC`,
    [applicantProfileId],
  );
}

export function startupToolKeysFromHistory(history: StartupToolHistoryRow[]): string[] {
  const keys = new Set<string>();
  for (const row of history) {
    const key = normalizeStartupToolName(row.tool_name || "");
    if (key) keys.add(key);
  }
  return [...keys];
}

export function validateStartupToolNotPreviouslyApplied(
  applicantProfileId: string,
  toolName: string,
  excludeApplicationId?: string,
): string | null {
  const normalized = normalizeStartupToolName(toolName);
  if (!normalized) return "Specify the start-up tool or equipment needed.";
  const history = listStartupToolHistory(applicantProfileId).filter((row) => row.id !== excludeApplicationId);
  const applied = startupToolKeysFromHistory(history);
  if (applied.includes(normalized)) {
    return "This start-up tool has been requested before and cannot be applied for again.";
  }
  return null;
}

export function validateStartupToolDetails(
  applicantProfileId: string,
  category: string,
  details: Record<string, unknown>,
  excludeApplicationId?: string,
): string | null {
  if (category !== "income_generating") return null;
  const subtype = details.subtype != null ? String(details.subtype).trim() : "";
  if (subtype !== "startup_tool") return null;
  const spec =
    details.itemSpecification != null
      ? String(details.itemSpecification).trim()
      : details.item_specification != null
        ? String(details.item_specification).trim()
        : "";
  if (!spec) return "Specify the start-up tool or equipment needed.";
  return validateStartupToolNotPreviouslyApplied(applicantProfileId, spec, excludeApplicationId);
}
