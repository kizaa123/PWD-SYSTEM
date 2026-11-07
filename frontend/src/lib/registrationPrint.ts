import { formatAppDate, formatAppDateFromIso } from "./dateFormat";
import { disabilityFromRegistration } from "./disabilityScheduleB";
import {
  formatResidenceType,
  formatSex,
  relationshipLabel,
} from "./applicantUtils";
import { displayGhanaCard } from "./ghanaCardFormat";

export type RegistrationPrintRow = { label: string; value: string };

export type RegistrationPrintSection = {
  title: string;
  rows: RegistrationPrintRow[];
};

export type RegistrationPrintPhoto = {
  applicantProfileId: string;
  subject: "caregiver" | "beneficiary";
  photoPath: string | null;
  caption: string;
};

export type RegistrationPrintSnapshot = {
  documentTitle: string;
  registrationTypeLabel: string;
  applicantRef: string;
  region: string;
  district: string;
  printedAt: string;
  registeredAt: string;
  endorsedBy: string;
  primaryPhoto: RegistrationPrintPhoto | null;
  secondaryPhoto: RegistrationPrintPhoto | null;
  sections: RegistrationPrintSection[];
};

type CaregiverRow = {
  status?: string;
  full_name: string;
  phone: string | null;
  sex: string | null;
  age: number | null;
  home_address: string | null;
  relationship: string;
  relationship_other: string | null;
  hours_of_caregiving: string | null;
  years_of_caregiving: string | null;
  education_level?: string | null;
  residence_type?: string | null;
  residence_other?: string | null;
  caregiver_ghana_card?: string | null;
  community_name?: string | null;
};

type ApplicantForPrint = {
  id: string;
  applicant_ref: string;
  full_name: string;
  age: number | null;
  sex: string | null;
  phone: string | null;
  home_address: string | null;
  community_name: string | null;
  region_name: string;
  district_name: string;
  occupation: string | null;
  education_level: string | null;
  residence_type: string | null;
  residence_other: string | null;
  disability_category: string | null;
  disability_other: string | null;
  opd_member: number;
  opd_name: string | null;
  previous_fund: number;
  previous_fund_when: string | null;
  registration_type: string;
  created_at: string;
  photo_path: string | null;
  caregiver_photo_path: string | null;
  identifiers: { id_type: string; value_normalized: string }[];
  caregivers: CaregiverRow[];
};

function row(label: string, value: string | null | undefined): RegistrationPrintRow {
  const v = value?.trim();
  return { label, value: v || "" };
}

function caregiverCommunity(caregiver: CaregiverRow | undefined, profileCommunity: string | null): string {
  const fromCaregiver = caregiver?.community_name?.trim();
  if (fromCaregiver) return fromCaregiver;
  return profileCommunity?.trim() || "";
}

export function buildRegistrationPrintSnapshot(
  applicant: ApplicantForPrint,
  disabilities: string[],
  endorsedBy: string,
): RegistrationPrintSnapshot {
  const isCaregiverReg = applicant.registration_type === "caregiver";
  const caregiver = applicant.caregivers.find((c) => c.status === "active") ?? applicant.caregivers[0];
  const ghanaCard = applicant.identifiers.find((i) => i.id_type === "ghana_card")?.value_normalized;
  const nhis = applicant.identifiers.find((i) => i.id_type === "nhis")?.value_normalized;
  const disabilityDisplay = disabilityFromRegistration(
    applicant.disability_category,
    applicant.disability_other,
    disabilities,
  ).display;

  const sections: RegistrationPrintSection[] = [];

  const regionDistrict = [
    row("Region", applicant.region_name),
    row("District", applicant.district_name),
  ];

  if (isCaregiverReg && caregiver) {
    sections.push({
      title: "Caregiver particulars",
      rows: [
        row("Full name", caregiver.full_name),
        row("Age", caregiver.age != null ? String(caregiver.age) : ""),
        ...regionDistrict,
        row("Sex", formatSex(caregiver.sex) === "—" ? "" : formatSex(caregiver.sex)),
        row("Phone / contact", caregiver.phone),
        row("Ghana Card (PIN)", caregiver.caregiver_ghana_card ? displayGhanaCard(caregiver.caregiver_ghana_card) : ""),
        row("Level of education", caregiver.education_level),
        row("Town or community", caregiverCommunity(caregiver, applicant.community_name)),
        row("Home address / landmark", caregiver.home_address),
        row("Type of residence", formatResidenceType(caregiver.residence_type, caregiver.residence_other)),
        row("Relationship to beneficiary", relationshipLabel(caregiver.relationship, caregiver.relationship_other)),
        row("Hours of caregiving per day", caregiver.hours_of_caregiving),
        row("Years of caregiving", caregiver.years_of_caregiving),
      ],
    });

    sections.push({
      title: "Person receiving care (beneficiary)",
      rows: [
        row("Full name", applicant.full_name),
        row("Age", applicant.age != null ? String(applicant.age) : ""),
        row("Sex", formatSex(applicant.sex) === "—" ? "" : formatSex(applicant.sex)),
        row("Phone / contact", applicant.phone),
        row("Ghana Card (PIN)", ghanaCard ? displayGhanaCard(ghanaCard) : ""),
        row("NHIS card number", nhis),
        row("Level of education", applicant.education_level),
        row("Occupation", applicant.occupation),
        row("Town or community", applicant.community_name),
        row("Home address / landmark", applicant.home_address),
        row("Category of disability", disabilityDisplay === "—" ? "" : disabilityDisplay),
      ],
    });
  } else {
    sections.push({
      title: "Applicant particulars",
      rows: [
        row("Full name", applicant.full_name),
        row("Age", applicant.age != null ? String(applicant.age) : ""),
        ...regionDistrict,
        row("Sex", formatSex(applicant.sex) === "—" ? "" : formatSex(applicant.sex)),
        row("Phone / contact", applicant.phone),
        row("Ghana Card (PIN)", ghanaCard ? displayGhanaCard(ghanaCard) : ""),
        row("NHIS card number", nhis),
        row("Level of education", applicant.education_level),
        row("Occupation", applicant.occupation),
        row("Town or community", applicant.community_name),
        row("Home address / landmark", applicant.home_address),
        row("Type of residence", formatResidenceType(applicant.residence_type, applicant.residence_other)),
        row("Category of disability", disabilityDisplay === "—" ? "" : disabilityDisplay),
      ],
    });
  }

  sections.push({
    title: "Registration office use",
    rows: [
      row("Date registered", formatAppDateFromIso(applicant.created_at) || "—"),
      row("Registered by", endorsedBy),
    ],
  });

  sections.push({
    title: "Membership & prior support",
    rows: [
      row(
        "OPD membership",
        applicant.opd_member
          ? `Yes${applicant.opd_name?.trim() ? ` — ${applicant.opd_name.trim()}` : ""}`
          : "No",
      ),
      row(
        "Previous DACF support",
        applicant.previous_fund
          ? `Yes${applicant.previous_fund_when?.trim() ? ` — ${applicant.previous_fund_when.trim()}` : ""}`
          : "No",
      ),
    ],
  });

  const primaryPhoto: RegistrationPrintPhoto | null = isCaregiverReg
    ? {
        applicantProfileId: applicant.id,
        subject: "caregiver",
        photoPath: applicant.caregiver_photo_path,
        caption: "Caregiver passport photo",
      }
    : applicant.photo_path
      ? {
          applicantProfileId: applicant.id,
          subject: "beneficiary",
          photoPath: applicant.photo_path,
          caption: "Applicant passport photo",
        }
      : null;

  const secondaryPhoto: RegistrationPrintPhoto | null =
    isCaregiverReg && applicant.photo_path
      ? {
          applicantProfileId: applicant.id,
          subject: "beneficiary",
          photoPath: applicant.photo_path,
          caption: "Beneficiary passport photo",
        }
      : null;

  return {
    documentTitle: "PWD Care Fund — Registration Record",
    registrationTypeLabel: isCaregiverReg ? "Caregiver registration" : "PWD registration",
    applicantRef: applicant.applicant_ref,
    region: applicant.region_name,
    district: applicant.district_name,
    printedAt: formatAppDate(new Date()),
    registeredAt: formatAppDateFromIso(applicant.created_at) || "—",
    endorsedBy,
    primaryPhoto,
    secondaryPhoto,
    sections,
  };
}
