/** Standard education levels used at registration (PWD and caregiver). */

export const EDUCATION_LEVEL_OPTIONS = [
  "Basic",
  "Secondary",
  "Tertiary",
  "Vocational/Apprenticeship",
  "None",
  "Other",
] as const;

export type EducationLevelOption = (typeof EDUCATION_LEVEL_OPTIONS)[number];

const LEGACY_LEVEL_MAP: Record<string, string> = {
  JHS: "Basic",
  "SHS / Secondary": "Secondary",
  Vocational: "Vocational/Apprenticeship",
};

/** Include a saved value that is not in the preset list (legacy free text). */
export function educationLevelChoices(currentValue: string): string[] {
  const v = currentValue.trim();
  const mapped = LEGACY_LEVEL_MAP[v] ?? v;
  if (!mapped) return [...EDUCATION_LEVEL_OPTIONS];
  if ((EDUCATION_LEVEL_OPTIONS as readonly string[]).includes(mapped)) return [...EDUCATION_LEVEL_OPTIONS];
  return [...EDUCATION_LEVEL_OPTIONS];
}

export function parseEducationLevelForForm(stored: string | null | undefined): { level: string; other: string } {
  const v = (stored ?? "").trim();
  if (!v) return { level: "", other: "" };
  const mapped = LEGACY_LEVEL_MAP[v] ?? v;
  if ((EDUCATION_LEVEL_OPTIONS as readonly string[]).includes(mapped)) return { level: mapped, other: "" };
  return { level: "Other", other: mapped };
}

export function educationLevelForSubmit(level: string, other: string): string {
  const l = level.trim();
  if (!l) return "";
  if (l === "Other") return other.trim();
  return l;
}

export function isPresetEducationLevel(value: string): boolean {
  const v = value.trim();
  if ((EDUCATION_LEVEL_OPTIONS as readonly string[]).includes(v)) return true;
  return Boolean(LEGACY_LEVEL_MAP[v]);
}
