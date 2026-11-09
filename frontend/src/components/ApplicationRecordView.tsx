import { ApplicationDocumentActions } from "./ApplicationDocumentActions";
import { applicationDeclarationParts } from "../lib/applicationDeclaration";
import { supportingApplicationDocuments } from "../lib/applicationDocuments";
import { applicationSupportRequestRows, applicationSupportTypeColumnLabel } from "../lib/applicationSupportDisplay";
import { formatResidenceType, formatSex } from "../lib/applicantUtils";
import { disabilityFromRegistration } from "../lib/disabilityScheduleB";
import { formatAppDateTimeFromIso } from "../lib/dateFormat";
import {
  PASSPORT_PHOTO_BOX_PRIMARY,
  PASSPORT_PHOTO_PRIMARY_CLASS,
  RegisteredPassportPhoto,
} from "./RegisteredPassportPhoto";
import { ReferenceNumber } from "./StatusBadge";

export type RecordCaregiver = {
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
  community_name?: string | null;
};

function caregiverTownCommunity(
  caregiver: RecordCaregiver | undefined,
  profileCommunity: string | null | undefined,
): string {
  const fromCaregiver = caregiver?.community_name?.trim();
  if (fromCaregiver) return fromCaregiver;
  return profileCommunity?.trim() || "—";
}

export type RecordApplicant = {
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
  disability_category: string | null;
  disability_other: string | null;
  opd_member: number;
  opd_name: string | null;
  photo_path: string | null;
  caregiver_photo_path: string | null;
  registration_type: string;
  registered_by_name: string | null;
  caregivers?: RecordCaregiver[];
};

export type RecordApplication = {
  id: string;
  reference: string;
  category_code: string;
  category_name: string;
  created_at: string;
  amount_requested_pesewas: number | null;
  purpose_summary: string | null;
  applicant_signature_label: string | null;
  endorsing_officer_name: string | null;
  endorsed_by_name?: string | null;
  office_use_qualified: string | null;
  office_use_remarks: string | null;
  details: Record<string, unknown> | null;
  documents?: {
    id: string;
    document_type: string;
    original_name: string;
    mime_type?: string | null;
    is_medical?: number;
  }[];
};

function DetailLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 py-1">
      <div className="text-xs font-medium leading-snug text-muted">{label}</div>
      <div className="mt-1.5 text-sm font-medium leading-relaxed text-navy">{value ?? "—"}</div>
    </div>
  );
}

type Props = {
  applicant: RecordApplicant;
  application: RecordApplication;
  disabilities?: string[];
  /** Modal header already shows the passport — hide inline copies in the body. */
  hideInlinePassportPhotos?: boolean;
  /** Hide applicant signature/thumbprint on screen; still shown on print sheets. */
  hideApplicantSignature?: boolean;
};

export function ApplicationRecordView({
  applicant,
  application,
  disabilities = [],
  hideInlinePassportPhotos = false,
  hideApplicantSignature = false,
}: Props) {
  const isCaregiverReg = applicant.registration_type === "caregiver";
  const caregiver = applicant.caregivers?.[0];
  const relationship =
    caregiver?.relationship === "Other" && caregiver.relationship_other?.trim()
      ? caregiver.relationship_other.trim()
      : caregiver?.relationship || "—";
  const registrationEndorsedBy = applicant.registered_by_name?.trim() || "—";
  const applicationEndorsedBy =
    application.endorsing_officer_name?.trim() || application.endorsed_by_name?.trim() || "—";
  const applicantSignOrThumb = application.applicant_signature_label?.trim() || "—";
  const disability = disabilityFromRegistration(
    applicant.disability_category,
    applicant.disability_other,
    disabilities,
  );
  const openedAt = formatAppDateTimeFromIso(application.created_at) || "—";
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
  const supportingDocs = supportingApplicationDocuments(application.documents);
  const details = application.details ?? {};
  const schoolName =
    String(details.school_name ?? details.schoolName ?? "").trim() ||
    (() => {
      const blob = String(details.purpose_other ?? details.purposeOther ?? "");
      const m = blob.match(/^School name:\s*(.+)$/im);
      return m?.[1]?.trim() || "";
    })();
  const schoolAccount =
    String(details.school_account_number ?? details.schoolAccountNumber ?? "").trim() ||
    (() => {
      const blob = String(details.purpose_other ?? details.purposeOther ?? "");
      const m = blob.match(/^School account No\.:\s*(.+)$/im);
      return m?.[1]?.trim() || "";
    })();
  const showEducationSchool =
    application.category_code === "education" ||
    schoolName ||
    schoolAccount ||
    supportingDocs.some((d) => d.document_type === "admission_letter" || d.document_type === "school_invoice");
  const declaration = applicationDeclarationParts({
    registrationType: applicant.registration_type,
    relationship: caregiver?.relationship,
    beneficiaryName: applicant.full_name,
  });
  return (
    <div className="space-y-4">
      <div className="space-y-8 rounded-2xl bg-white p-6 md:p-8">
        <div>
          <h3 className="text-lg font-bold text-navy">
            Applicant particulars{isCaregiverReg ? " (Caregiver)" : ""}
          </h3>
          <p className="mt-1 text-sm text-muted">{application.reference}</p>
        </div>

        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <DetailLine label="Date of application" value={openedAt} />
          <DetailLine label="Applicant number" value={<ReferenceNumber>{applicant.applicant_ref}</ReferenceNumber>} />
          <DetailLine label="Name of region" value={applicant.region_name} />
          <DetailLine label="Name of district" value={applicant.district_name} />
        </div>

        {isCaregiverReg ? (
          <div className="space-y-10 border-t border-canvas pt-8">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wide text-teal">Caregiver</h4>
              <div className="mt-4 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
                <div className="min-w-0 flex-1 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  <DetailLine label="Name of caregiver" value={caregiver?.full_name || "—"} />
                  <DetailLine label="Age" value={caregiver?.age != null ? String(caregiver.age) : "—"} />
                  <DetailLine label="Sex" value={formatSex(caregiver?.sex ?? null)} />
                  <DetailLine label="Contact" value={caregiver?.phone?.trim() || "—"} />
                  <DetailLine
                    label="Name of town or community"
                    value={caregiverTownCommunity(caregiver, applicant.community_name)}
                  />
                  <DetailLine label="Home address" value={caregiver?.home_address?.trim() || "—"} />
                  <DetailLine label="Level of education" value={caregiver?.education_level?.trim() || "—"} />
                  <DetailLine
                    label="Type of residence"
                    value={formatResidenceType(caregiver?.residence_type, caregiver?.residence_other)}
                  />
                  <DetailLine label="Relationship to beneficiary" value={relationship} />
                  <DetailLine label="Hours of caregiving per day" value={caregiver?.hours_of_caregiving?.trim() || "—"} />
                  <DetailLine label="Years of caregiving" value={caregiver?.years_of_caregiving?.trim() || "—"} />
                </div>
                {!hideInlinePassportPhotos ? (
                  <div className="flex shrink-0 justify-center lg:justify-end">
                    <RegisteredPassportPhoto
                      applicantProfileId={applicant.id}
                      subject="caregiver"
                      size="small"
                      align="end"
                      photoPath={applicant.caregiver_photo_path}
                      className={PASSPORT_PHOTO_PRIMARY_CLASS}
                      boxMaxWidthClass={PASSPORT_PHOTO_BOX_PRIMARY}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-canvas pt-8">
              <h4 className="text-sm font-bold uppercase tracking-wide text-teal">Beneficiary (person receiving care)</h4>
              <div className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                <DetailLine label="Name of beneficiary" value={applicant.full_name} />
                <DetailLine label="Age" value={applicant.age != null ? String(applicant.age) : "—"} />
                <DetailLine label="Sex" value={formatSex(applicant.sex)} />
                <DetailLine label="Level of education" value={applicant.education_level || "—"} />
                <DetailLine label="Occupation (if any)" value={applicant.occupation || "—"} />
                <DetailLine label="Contact" value={applicant.phone || "—"} />
                <div className="sm:col-span-2">
                  <DetailLine label="Home address" value={applicant.home_address || "—"} />
                </div>
                <DetailLine label="Endorsed by (registration)" value={registrationEndorsedBy} />
              </div>
              <div className="mt-6 border-t border-canvas pt-6">
                <div className="text-xs font-medium leading-snug text-muted">Type of disability (Schedule B)</div>
                <div className="mt-2 text-sm font-medium leading-relaxed text-navy">
                  {disability.display || "Not recorded at registration"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8 border-t border-canvas pt-8 lg:flex-row lg:items-start lg:gap-10">
            <div className="min-w-0 flex-1 space-y-8">
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                <DetailLine label="Name of applicant" value={applicant.full_name} />
                <DetailLine label="Age" value={applicant.age != null ? String(applicant.age) : "—"} />
                <DetailLine label="Sex" value={formatSex(applicant.sex)} />
                <DetailLine label="Occupation (if any)" value={applicant.occupation || "—"} />
                <DetailLine label="Contact" value={applicant.phone || "—"} />
                <DetailLine label="Name of town or community" value={applicant.community_name || "—"} />
                <div className="sm:col-span-2">
                  <DetailLine label="Home address" value={applicant.home_address || "—"} />
                </div>
                <DetailLine label="Endorsed by (registration)" value={registrationEndorsedBy} />
              </div>
              <div className="border-t border-canvas pt-8">
                <div className="text-xs font-medium leading-snug text-muted">Type of disability (Schedule B)</div>
                <div className="mt-2 text-sm font-medium leading-relaxed text-navy">
                  {disability.display || "Not recorded at registration"}
                </div>
              </div>
            </div>
            {!hideInlinePassportPhotos ? (
              <div className="flex shrink-0 justify-center lg:justify-end">
                <RegisteredPassportPhoto
                  applicantProfileId={applicant.id}
                  subject="beneficiary"
                  size="small"
                  align="end"
                  photoPath={applicant.photo_path}
                  className={PASSPORT_PHOTO_PRIMARY_CLASS}
                  boxMaxWidthClass={PASSPORT_PHOTO_BOX_PRIMARY}
                />
              </div>
            ) : null}
          </div>
        )}

        <div className="border-t border-canvas pt-8">
          <div className="text-xs font-medium leading-snug text-muted">Are you a member of any OPDs (organization)?</div>
          <div className="mt-2 text-sm font-medium text-navy">
            {applicant.opd_member ? `Yes${applicant.opd_name?.trim() ? ` — ${applicant.opd_name.trim()}` : ""}` : "No"}
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl bg-white p-6 shadow-sm md:p-8">
        <div className="space-y-3 text-sm text-navy">
          <div className="font-semibold">Application:</div>
          <p className="leading-relaxed">
            {declaration.before}
            {declaration.beneficiaryName ? (
              <span className="font-semibold text-teal">{declaration.beneficiaryName}</span>
            ) : null}
            {declaration.after}
          </p>
          <div className="font-semibold">Purpose:</div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold text-navy">Support requested on this application</h4>
          <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {supportRows.map((row) => (
              <div key={row.label} className="min-w-0">
                <dt className="text-xs font-medium leading-snug text-muted">{row.label}</dt>
                <dd className="mt-1 text-sm font-medium leading-snug text-navy">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <DetailLine label="Type of support" value={supportTypeLabel} />
          {showEducationSchool && schoolName ? <DetailLine label="School name" value={schoolName} /> : null}
          {showEducationSchool && schoolAccount ? (
            <DetailLine label="School account No." value={schoolAccount} />
          ) : null}
        </div>

        <ApplicationDocumentActions documents={supportingDocs} />

        <div className="space-y-4 border-t border-canvas pt-6">
          {!hideApplicantSignature ? (
            <DetailLine label="Signature / Thumbprint (applicant)" value={applicantSignOrThumb} />
          ) : null}
          <DetailLine label="Endorsed by (application)" value={applicationEndorsedBy} />
        </div>
      </div>
    </div>
  );
}
