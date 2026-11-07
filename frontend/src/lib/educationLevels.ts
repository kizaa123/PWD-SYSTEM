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
  return [v, ...EDUCATION_LEVEL_OPTIONS];
}
