import type { ApplicationPrintSnapshot } from "../components/ApplicationPrintSheet";
import type { RecordApplicant, RecordApplication } from "../components/ApplicationRecordView";
import { applicationDeclarationSentence } from "./applicationDeclaration";
import { applicationDocumentTypeLabel, supportingApplicationDocuments } from "./applicationDocuments";
import { applicationSupportRequestRows, applicationSupportTypeColumnLabel } from "./applicationSupportDisplay";
import { formatResidenceType, formatSex } from "./applicantUtils";
import { disabilityFromRegistration } from "./disabilityScheduleB";
import { formatAppDate, formatAppDateFromIso } from "./dateFormat";

export function buildApplicationPrintSnapshot(
  applicant: RecordApplicant,
  application: RecordApplication,
  disabilities: string[],
): ApplicationPrintSnapshot {
  const isCaregiverReg = applicant.registration_type === "caregiver";
  const caregiver = applicant.caregivers?.[0];
  const relationship =
    caregiver?.relationship === "Other" && caregiver.relationship_other?.trim()
      ? caregiver.relationship_other.trim()
      : caregiver?.relationship || "—";
  const disability = disabilityFromRegistration(
    applicant.disability_category,
    applicant.disability_other,
    disabilities,
  ).display;
  const openedAt = formatAppDateFromIso(application.created_at) || "—";
  const supportTypeLabel = applicationSupportTypeColumnLabel(
    application.category_code,
    application.category_name,
    application.purpose_summary,
    application.details,
  );
  const supportRows = applicationSupportRequestRows(
    application.category_code,
    application.category_name,
    application.details,
    application.purpose_summary,
  );
  const purposeRows = [
    ...supportRows.map((r) => ({ label: r.label, value: r.value })),
    { label: "Type of support", value: supportTypeLabel },
  ];
  const docs = supportingApplicationDocuments(application.documents);
  for (const d of docs) {
    purposeRows.push({
      label: applicationDocumentTypeLabel(d.document_type),
      value: d.original_name || "On file",
    });
  }
  const details = application.details ?? {};
  const schoolName = String(details.school_name ?? details.schoolName ?? "").trim();
  const schoolAccount = String(details.school_account_number ?? details.schoolAccountNumber ?? "").trim();
  if (schoolName) purposeRows.push({ label: "School name", value: schoolName });
  if (schoolAccount) purposeRows.push({ label: "School account No.", value: schoolAccount });

  const registrationEndorsedBy = applicant.registered_by_name?.trim() || "";
  const applicationEndorsedBy =
    application.endorsing_officer_name?.trim() || application.endorsed_by_name?.trim() || "";

  const sections: ApplicationPrintSnapshot["sections"] = [
    {
      title: "Application & location",
      rows: [
        { label: "Date of application", value: openedAt },
        { label: "Applicant number", value: applicant.applicant_ref },
        { label: "Region", value: applicant.region_name },
        { label: "District", value: applicant.district_name },
        { label: "Town or community", value: applicant.community_name?.trim() || "—" },
      ],
    },
  ];

  if (isCaregiverReg) {
    sections.push(
      {
        title: "Caregiver",
        rows: [
          { label: "Name", value: caregiver?.full_name || "—" },
          { label: "Age", value: caregiver?.age != null ? String(caregiver.age) : "—" },
          { label: "Sex", value: formatSex(caregiver?.sex ?? null) },
          { label: "Contact", value: caregiver?.phone?.trim() || "—" },
          { label: "Home address", value: caregiver?.home_address?.trim() || "—" },
          { label: "Level of education", value: caregiver?.education_level?.trim() || "—" },
          {
            label: "Type of residence",
            value: formatResidenceType(caregiver?.residence_type, caregiver?.residence_other),
          },
          { label: "Relationship to beneficiary", value: relationship },
          { label: "Hours of caregiving per day", value: caregiver?.hours_of_caregiving?.trim() || "—" },
          { label: "Years of caregiving", value: caregiver?.years_of_caregiving?.trim() || "—" },
        ],
      },
      {
        title: "Beneficiary (person receiving care)",
        rows: [
          { label: "Name", value: applicant.full_name },
          { label: "Age", value: applicant.age != null ? String(applicant.age) : "—" },
          { label: "Sex", value: formatSex(applicant.sex) },
          { label: "Education", value: applicant.education_level?.trim() || "—" },
          { label: "Occupation", value: applicant.occupation?.trim() || "—" },
          { label: "Contact", value: applicant.phone?.trim() || "—" },
          { label: "Home address", value: applicant.home_address?.trim() || "—" },
        ],
      },
    );
  } else {
    sections.push({
      title: "Personal details",
      rows: [
        { label: "Name of applicant", value: applicant.full_name },
        { label: "Age", value: applicant.age != null ? String(applicant.age) : "—" },
        { label: "Sex", value: formatSex(applicant.sex) },
        { label: "Occupation", value: applicant.occupation?.trim() || "—" },
        { label: "Contact", value: applicant.phone?.trim() || "—" },
        { label: "Home address", value: applicant.home_address?.trim() || "—" },
        { label: "Education level", value: applicant.education_level?.trim() || "—" },
      ],
    });
  }

  sections.push(
    {
      title: "Disability & OPD membership",
      rows: [
        { label: "Type of disability", value: disability || "—" },
        {
          label: "Member of OPD",
          value: applicant.opd_member
            ? `Yes${applicant.opd_name?.trim() ? ` — ${applicant.opd_name.trim()}` : ""}`
            : "No",
        },
      ],
    },
    {
      title: "Purpose of support",
      rows: purposeRows,
    },
    {
      title: "For office use only",
      rows: [
        {
          label: "Remarks",
          value:
            application.office_use_qualified === "qualified"
              ? "Qualified"
              : application.office_use_qualified === "not_qualified"
                ? "Not Qualified"
                : "—",
        },
        { label: "Additional remarks", value: application.office_use_remarks?.trim() || "—" },
      ],
    },
  );

  const primaryPhoto = isCaregiverReg
    ? applicant.caregiver_photo_path
      ? {
          applicantProfileId: applicant.id,
          subject: "caregiver" as const,
          photoPath: applicant.caregiver_photo_path,
          caption: "Caregiver passport photo",
        }
      : null
    : applicant.photo_path
      ? {
          applicantProfileId: applicant.id,
          subject: "beneficiary" as const,
          photoPath: applicant.photo_path,
          caption: "Applicant passport photo",
        }
      : null;
  const secondaryPhoto =
    isCaregiverReg && applicant.photo_path
      ? {
          applicantProfileId: applicant.id,
          subject: "beneficiary" as const,
          photoPath: applicant.photo_path,
          caption: "Beneficiary passport photo",
        }
      : null;

  const signLabel = application.applicant_signature_label?.trim().toLowerCase() ?? "";
  const applicantSignatureMode: ApplicationPrintSnapshot["applicantSignatureMode"] = signLabel.includes("thumb")
    ? "thumbprint"
    : signLabel
      ? "signature"
      : "";

  return {
    documentTitle: "PWD Care Fund — Support Application",
    applicationTypeLabel: isCaregiverReg ? "Caregiver support application" : "PWD support application",
    applicantRef: applicant.applicant_ref,
    printedAt: formatAppDate(new Date()),
    declaration: applicationDeclarationSentence({
      registrationType: applicant.registration_type,
      relationship: caregiver?.relationship,
      beneficiaryName: applicant.full_name,
    }),
    registrationEndorsedByName: registrationEndorsedBy,
    applicationEndorsedByName: applicationEndorsedBy,
    applicantSignatureMode,
    primaryPhoto,
    secondaryPhoto,
    sections,
  };
}
