/** List-row fields returned by GET /api/applicants for table display. */
export type RegistrationListRow = {
  full_name: string;
  phone?: string | null;
  registration_type?: string;
  caregiver_full_name?: string | null;
  caregiver_phone?: string | null;
  community_name?: string | null;
  caregiver_community_name?: string | null;
  ghana_card_masked?: string | null;
  caregiver_ghana_card_masked?: string | null;
  disability_category?: string | null;
};

/** Caregiver registrations list the caregiver as the registered person, not the beneficiary. */
export function registrationListPrimaryName(row: RegistrationListRow): string {
  if (row.registration_type === "caregiver" && row.caregiver_full_name?.trim()) {
    return row.caregiver_full_name.trim();
  }
  return row.full_name?.trim() || "—";
}

export function registrationListPrimaryPhone(row: RegistrationListRow): string {
  if (row.registration_type === "caregiver" && row.caregiver_phone?.trim()) {
    return row.caregiver_phone.trim();
  }
  return row.phone?.trim() || "—";
}

export function registrationListPrimaryCommunity(row: RegistrationListRow): string {
  if (row.registration_type === "caregiver" && row.caregiver_community_name?.trim()) {
    return row.caregiver_community_name.trim();
  }
  return row.community_name?.trim() || "—";
}

export function registrationListPrimaryGhanaCard(row: RegistrationListRow): string {
  if (row.registration_type === "caregiver") {
    return row.caregiver_ghana_card_masked?.trim() || "—";
  }
  return row.ghana_card_masked?.trim() || "—";
}

export function registrationListDisabilityLabel(row: RegistrationListRow): string {
  const category = row.disability_category?.trim() || "—";
  if (row.registration_type === "caregiver") {
    return category === "—" ? "—" : `Beneficiary · ${category}`;
  }
  return category;
}
