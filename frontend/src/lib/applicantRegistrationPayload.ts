export function buildApplicantRegistrationBody(
  form: Record<string, string>,
  registrationType: "pwd" | "caregiver",
  clientRegistrationId: string,
) {
  return {
    ...form,
    registrationType,
    clientRegistrationId,
    age: form.age ? Number(form.age) : null,
    caregiverAge: form.caregiverAge ? Number(form.caregiverAge) : null,
  };
}
