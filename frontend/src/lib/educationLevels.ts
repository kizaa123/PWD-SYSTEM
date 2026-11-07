/** Standard education levels used at registration (PWD and caregiver). */

export const EDUCATION_LEVEL_OPTIONS = [
  "None",
  "Basic",
  "JHS",
  "SHS / Secondary",
  "Secondary",
  "Vocational",
  "Tertiary",
  "Other",
] as const;

export type EducationLevelOption = (typeof EDUCATION_LEVEL_OPTIONS)[number];

/** Include a saved value that is not in the preset list (legacy free text). */
export function educationLevelChoices(currentValue: string): string[] {
  const v = currentValue.trim();
  if (!v) return [...EDUCATION_LEVEL_OPTIONS];
  if ((EDUCATION_LEVEL_OPTIONS as readonly string[]).includes(v)) return [...EDUCATION_LEVEL_OPTIONS];
  return [...EDUCATION_LEVEL_OPTIONS];
}

export function parseEducationLevelForForm(stored: string | null | undefined): { level: string; other: string } {
  const v = (stored ?? "").trim();
  if (!v) return { level: "", other: "" };
  if ((EDUCATION_LEVEL_OPTIONS as readonly string[]).includes(v)) return { level: v, other: "" };
  return { level: "Other", other: v };
}

export function educationLevelForSubmit(level: string, other: string): string {
  const l = level.trim();
  if (!l) return "";
  if (l === "Other") return other.trim();
  return l;
}

export function isPresetEducationLevel(value: string): boolean {
  return (EDUCATION_LEVEL_OPTIONS as readonly string[]).includes(value.trim());
}
