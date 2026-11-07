import { EMPTY_PURPOSE_FORM, type PurposeFormState } from "./supportPurposeOptions";

export type RegistrationSupportIntake = {
  version: 1;
  registrationType: "pwd" | "caregiver";
  categoryCode: string;
  categoryLabel: string;
  supportType: string | null;
  purposeForm: Partial<PurposeFormState>;
  applicationDetails: Record<string, unknown>;
  summaryLines: string[];
  purposeSummarySeed: string;
};

export function purposeFormFromIntake(intake: RegistrationSupportIntake): PurposeFormState {
  return { ...EMPTY_PURPOSE_FORM, ...intake.purposeForm } as PurposeFormState;
}
