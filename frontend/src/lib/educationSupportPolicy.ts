import type { RegistrationSupportIntake } from "./registrationIntake";

/** DACF support type for this application (health / education), including caregiver registrations. */
export function applicationSupportTypeCode(
  categoryCode: string,
  intake?: RegistrationSupportIntake | null,
): "health" | "education" | null {
  const fromIntake = intake?.supportType?.trim();
  if (fromIntake === "health" || fromIntake === "education") return fromIntake;
  if (categoryCode === "health" || categoryCode === "education") return categoryCode;
  return null;
}

export type EducationSchoolPurposeHint = {
  educationTrack?: string;
  educationalSupportType?: string;
};

export function applicationRequiresEducationSchoolDetails(
  categoryCode: string,
  intake?: RegistrationSupportIntake | null,
  purpose?: EducationSchoolPurposeHint,
): boolean {
  if (applicationSupportTypeCode(categoryCode, intake) !== "education") return false;
  if (purpose?.educationTrack === "apprenticeship") return false;
  const st = purpose?.educationalSupportType;
  if (st === "technical_aid") return false;
  return st === "school_fees" || st === "bursary";
}

export const EDUCATION_SCHOOL_NAME_MESSAGE = "Enter the school name.";
export const EDUCATION_SCHOOL_ACCOUNT_MESSAGE = "Enter the school account number.";

export const EDUCATION_SCHOOL_LETTER_HELPER =
  "Optional: upload a letter from the school (admission letter, invoice, or fee statement).";
