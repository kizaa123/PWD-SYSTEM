import type { RegistrationSupportIntake } from "./registrationIntake";
import { buildDetailsFromPurposeForm, type PurposeFormState } from "./supportPurposeOptions";

export function mergeApplicationSubmitDetails(opts: {
  registeredIntake: RegistrationSupportIntake | null;
  category: string;
  purposeForm: PurposeFormState;
}): Record<string, unknown> {
  const { registeredIntake, category, purposeForm } = opts;
  const submitCategory = registeredIntake?.categoryCode || category;
  let base: Record<string, unknown> = registeredIntake?.applicationDetails
    ? { ...registeredIntake.applicationDetails }
    : buildDetailsFromPurposeForm(category, purposeForm);

  const supportType =
    registeredIntake?.supportType ??
    (category === "health" || category === "education" ? category : null);

  if (supportType === "education") {
    const schoolName = purposeForm.schoolName.trim();
    const schoolAccountNumber = purposeForm.schoolAccountNumber.trim();
    if (submitCategory === "education") {
      base = { ...base, schoolName, schoolAccountNumber };
    } else if (schoolName || schoolAccountNumber) {
      const lines = [
        schoolName ? `School name: ${schoolName}` : "",
        schoolAccountNumber ? `School account No.: ${schoolAccountNumber}` : "",
      ].filter(Boolean);
      const prev = String(base.purposeOther ?? base.purpose_other ?? "").trim();
      base = { ...base, purposeOther: [...(prev ? [prev] : []), ...lines].join("\n") };
    }
  }

  return base;
}
