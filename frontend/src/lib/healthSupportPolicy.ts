import { applicationSupportTypeCode } from "./educationSupportPolicy";
import type { RegistrationSupportIntake } from "./registrationIntake";

/** Health support always requires a hospital medical document at application time. */
export function applicationRequiresMedicalDocument(
  categoryCode: string,
  intake?: RegistrationSupportIntake | null,
): boolean {
  return applicationSupportTypeCode(categoryCode, intake) === "health";
}

export const MEDICAL_DOCUMENT_HELPER =
  "Applicants requesting health support must provide a medical document from the hospital (prescription, bill, treatment report, referral letter, or similar proof).";

export const MEDICAL_DOCUMENT_VALIDATION_MESSAGE =
  "Upload a medical document from the hospital (prescription, bill, report, or referral) for health support applications.";
