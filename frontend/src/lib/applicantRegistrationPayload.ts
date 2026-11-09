import { educationLevelForSubmit } from "./educationLevels";

export function buildApplicantRegistrationBody(
  form: Record<string, string>,
  registrationType: "pwd" | "caregiver",
  clientRegistrationId: string,
) {
  return {
    ...form,
    educationLevel: educationLevelForSubmit(form.educationLevel, form.educationLevelOther ?? ""),
    caregiverEducationLevel: educationLevelForSubmit(
      form.caregiverEducationLevel ?? "",
      form.caregiverEducationLevelOther ?? "",
    ),
    registrationType,
    clientRegistrationId,
    age: form.age ? Number(form.age) : null,
    caregiverAge: form.caregiverAge ? Number(form.caregiverAge) : null,
  };
}
