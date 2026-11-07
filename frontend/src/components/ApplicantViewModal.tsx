import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import {
  formatResidenceType,
  formatSex,
  profileHasAppliedForSupportYear,
  profileHasCompletedSupportYear,
  relationshipLabel,
} from "../lib/applicantUtils";
import { ApplicantSupportHistoryTable } from "./ApplicantSupportHistoryTable";
import { ApplicationViewModal } from "./ApplicationViewModal";
import { disabilityFromRegistration } from "../lib/disabilityScheduleB";
import { displayGhanaCard } from "../lib/ghanaCardFormat";
import { displayNhis } from "../lib/nhisFormat";
import type { RegistrationSupportIntake } from "../lib/registrationIntake";
import { Button } from "./StatusBadge";
import {
  PASSPORT_PHOTO_BOX_PRIMARY,
  PASSPORT_PHOTO_BOX_SECONDARY,
  PASSPORT_PHOTO_PRIMARY_CLASS,
  PASSPORT_PHOTO_SECONDARY_CLASS,
  RegisteredPassportPhoto,
} from "./RegisteredPassportPhoto";
import { RegistrationIntakeSummary } from "./RegistrationIntakeSummary";
import { RegistrationPrintSheet } from "./RegistrationPrintSheet";
import { useAuth } from "../lib/auth";
import { formatAppDateFromIso } from "../lib/dateFormat";
import { buildRegistrationPrintSnapshot } from "../lib/registrationPrint";

type ApplicationSummary = {
  id: string;
  reference: string;
  category_code: string;
  category_name: string;
  application_year: number;
  status: string;
  amount_requested_pesewas: number | null;
  amount_approved_pesewas: number | null;
  created_at: string;
  office_use_qualified?: string | null;
};

type AssistiveDeviceHistory = {
  id: string;
  reference: string;
  application_year: number;
  status: string;
  assistive_device_key: string | null;
  assistive_device_type: string | null;
};

type CaregiverRow = {
  full_name: string;
  phone: string | null;
  sex: string | null;
  age: number | null;
  home_address: string | null;
  relationship: string;
  relationship_other: string | null;
  hours_of_caregiving: string | null;
  years_of_caregiving: string | null;
  status: string;
  education_level?: string | null;
  residence_type?: string | null;
  residence_other?: string | null;
  caregiver_ghana_card?: string | null;
  community_name?: string | null;
};

function caregiverTownCommunity(
  caregiver: CaregiverRow | undefined,
  profileCommunity: string | null | undefined,
): string {
  const fromCaregiver = caregiver?.community_name?.trim();
  if (fromCaregiver) return fromCaregiver;
  return profileCommunity?.trim() || "—";
}

type Applicant = {
  id: string;
  applicant_ref: string;
  full_name: string;
  age: number | null;
  sex: string | null;
  phone: string | null;
  email: string | null;
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
  registration_source: string;
  registered_by_name: string | null;
  created_at: string;
  photo_path: string | null;
  caregiver_photo_path: string | null;
  applied_current_year?: boolean;
  application_year?: number;
  identifiers: { id_type: string; value_normalized: string }[];
  caregivers: CaregiverRow[];
  applications: ApplicationSummary[];
  assistive_device_history?: AssistiveDeviceHistory[];
  registrationSupportIntake?: RegistrationSupportIntake | null;
};

type Props = {
  applicantId: string;
  onClose: () => void;
  onChanged?: () => void;
  /** Review step before applying: show Proceed Application instead of the list actions. */
  proceedFlow?: boolean;
  onProceedApplication?: () => void;
};

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-4 border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
      {title}
    </h3>
  );
}

function DetailItem({
  label,
  value,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 py-0.5 ${className}`.trim()}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1.5 text-sm font-semibold leading-relaxed text-navy break-words">{value ?? "—"}</div>
    </div>
  );
}

function ModalPassports({
  applicantId,
  isCaregiverReg,
  caregiverPhotoPath,
  beneficiaryPhotoPath,
}: {
  applicantId: string;
  isCaregiverReg: boolean;
  caregiverPhotoPath: string | null;
  beneficiaryPhotoPath: string | null;
}) {
  return (
    <div className="flex shrink-0 items-start gap-2">
      {isCaregiverReg ? (
        <>
          <RegisteredPassportPhoto
            applicantProfileId={applicantId}
            subject="caregiver"
            size="small"
            align="end"
            photoPath={caregiverPhotoPath}
            className={PASSPORT_PHOTO_PRIMARY_CLASS}
            boxMaxWidthClass={PASSPORT_PHOTO_BOX_PRIMARY}
          />
          {beneficiaryPhotoPath ? (
            <RegisteredPassportPhoto
              applicantProfileId={applicantId}
              subject="beneficiary"
              size="xs"
              align="end"
              photoPath={beneficiaryPhotoPath}
              className={PASSPORT_PHOTO_SECONDARY_CLASS}
              boxMaxWidthClass={PASSPORT_PHOTO_BOX_SECONDARY}
            />
          ) : null}
        </>
      ) : (
        <RegisteredPassportPhoto
          applicantProfileId={applicantId}
          subject="beneficiary"
          size="small"
          align="end"
          photoPath={beneficiaryPhotoPath}
          className={PASSPORT_PHOTO_PRIMARY_CLASS}
          boxMaxWidthClass={PASSPORT_PHOTO_BOX_PRIMARY}
        />
      )}
    </div>
  );
}

export function ApplicantViewModal({
  applicantId,
  onClose,
  proceedFlow = false,
  onProceedApplication,
}: Props) {
  const { has } = useAuth();
  const [applicant, setApplicant] = useState<Applicant | null>(null);
  const [disabilities, setDisabilities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingApplicationId, setViewingApplicationId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<Applicant>(`/api/applicants/${applicantId}`),
      api<{ disabilities: string[] }>("/api/auth/lookups").catch(() => ({ disabilities: [] as string[] })),
    ])
      .then(([data, lookups]) => {
        setApplicant(data);
        setDisabilities(lookups.disabilities);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [applicantId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const ghanaCard = applicant?.identifiers.find((i) => i.id_type === "ghana_card")?.value_normalized;
  const nhis = applicant?.identifiers.find((i) => i.id_type === "nhis")?.value_normalized;
  const caregiver = applicant?.caregivers.find((c) => c.status === "active") ?? applicant?.caregivers[0];
  const isCaregiverReg = applicant?.registration_type === "caregiver";
  const applied =
    applicant?.applied_current_year ??
    (applicant ? profileHasAppliedForSupportYear(applicant.applications, applicant.application_year) : false);

  const disabilityDisplay = applicant
    ? disabilityFromRegistration(applicant.disability_category, applicant.disability_other, disabilities).display
    : "—";

  const canEdit = has("applicants.update") || has("applicants.create");
  const completedThisYear = applicant ? profileHasCompletedSupportYear(applicant.applications) : false;
  const canApply = has("applications.create") && applicant && !applied && !completedThisYear;

  const currentYearApp = applicant?.applications.find(
    (a) =>
      a.application_year === (applicant.application_year ?? new Date().getFullYear()) &&
      a.status !== "cancelled" &&
      a.status !== "rejected",
  );

  const endorsedBy =
    applicant?.registered_by_name?.trim() ||
    (applicant?.registration_source === "self" ? "Self-registered (legacy)" : "—");

  const registrationPrintSnapshot = useMemo(() => {
    if (!applicant) return null;
    return buildRegistrationPrintSnapshot(applicant, disabilities, endorsedBy === "—" ? "" : endorsedBy);
  }, [applicant, disabilities, endorsedBy]);

  return (
    <>
      {registrationPrintSnapshot ? <RegistrationPrintSheet snapshot={registrationPrintSnapshot} /> : null}
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-xs sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="applicant-modal-title"
        className="relative flex max-h-[96vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-start gap-2 border-b border-slate-200 bg-white px-4 py-4 sm:gap-5 sm:px-8 sm:py-5">
          <div className="min-w-0 flex-1 pe-1 sm:pe-2">
            <div className="flex flex-wrap items-center gap-2">
              {applicant?.applicant_ref && (
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-700">
                  {applicant.applicant_ref}
                </span>
              )}
              {applicant && (
                <span className="inline-flex rounded-full border border-teal/20 bg-teal/10 px-2 py-0.5 text-[10px] font-medium leading-tight text-teal sm:text-xs">
                  {isCaregiverReg ? "Caregiver Registration" : "PWD Registration"}
                </span>
              )}
            </div>
            <h2
              id="applicant-modal-title"
              className="sr-only sm:not-sr-only sm:mt-2 sm:truncate sm:text-xl sm:font-bold sm:text-navy"
            >
              {loading
                ? "Loading applicant…"
                : isCaregiverReg && caregiver?.full_name
                  ? caregiver.full_name
                  : applicant?.full_name || "Applicant Record"}
            </h2>
          </div>

          {applicant && !loading && (
            <ModalPassports
              applicantId={applicant.id}
              isCaregiverReg={isCaregiverReg}
              caregiverPhotoPath={applicant.caregiver_photo_path}
              beneficiaryPhotoPath={applicant.photo_path}
            />
          )}

          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Body — no visible scrollbar */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-8 sm:py-7 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="space-y-8">
          {loading && (
            <div className="py-12 text-center text-sm text-slate-500">
              Loading registration details…
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {applicant && !loading && (
            <>
              {/* Registration & Location */}
              <section>
                <SectionHeader title="Registration & Location" />
                <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 md:grid-cols-3">
                  <DetailItem label="Date Registered" value={formatAppDateFromIso(applicant.created_at) || "—"} />
                  <DetailItem label="Registered By" value={endorsedBy} />
                  <DetailItem label="Region" value={applicant.region_name} className="sm:col-span-2 md:col-span-1" />
                  <DetailItem
                    label="District"
                    value={applicant.district_name}
                    className="sm:col-span-2 md:col-span-3"
                  />
                  {!isCaregiverReg && (
                    <>
                      <DetailItem
                        label="Town / Community"
                        value={applicant.community_name?.trim() || "—"}
                        className="sm:col-span-2 md:col-span-1"
                      />
                      <DetailItem
                        label="Home Address"
                        value={applicant.home_address?.trim() || "—"}
                        className="sm:col-span-2 md:col-span-2"
                      />
                    </>
                  )}
                </div>
              </section>

              {/* Caregiver Section (if Caregiver Registration) */}
              {isCaregiverReg && caregiver ? (
                <>
                  <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-5">
                        <SectionHeader title="Caregiver Information" />
                        <div className="grid gap-5 sm:grid-cols-2">
                          <DetailItem label="Caregiver Full Name" value={caregiver.full_name} />
                          <DetailItem
                            label="Caregiver Age / Sex"
                            value={`${caregiver.age ? `${caregiver.age} yrs` : "—"} · ${formatSex(caregiver.sex)}`}
                          />
                          <DetailItem label="Phone Contact" value={caregiver.phone?.trim() || "—"} />
                          <DetailItem
                            label="Town / Community"
                            value={caregiverTownCommunity(caregiver, applicant.community_name)}
                          />
                          <DetailItem label="Home Address" value={caregiver.home_address?.trim() || "—"} />
                          <DetailItem
                            label="Relationship"
                            value={relationshipLabel(caregiver.relationship, caregiver.relationship_other)}
                          />
                          <DetailItem label="Level of education" value={caregiver.education_level?.trim() || "—"} />
                          <DetailItem
                            label="Ghana Card (PIN)"
                            value={
                              caregiver.caregiver_ghana_card ? (
                                <span className="font-mono">{displayGhanaCard(caregiver.caregiver_ghana_card)}</span>
                              ) : (
                                "—"
                              )
                            }
                          />
                          <DetailItem
                            label="Residence"
                            value={formatResidenceType(caregiver.residence_type, caregiver.residence_other)}
                          />
                          <DetailItem label="Daily Care Hours" value={caregiver.hours_of_caregiving?.trim() || "—"} />
                          <DetailItem label="Years Caregiving" value={caregiver.years_of_caregiving?.trim() || "—"} />
                        </div>
                  </section>

                  {/* Beneficiary (Person receiving care) */}
                  <section>
                    <SectionHeader title="Beneficiary Particulars (Person Receiving Care)" />
                    <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3">
                      <DetailItem label="Full Name" value={applicant.full_name} />
                      <DetailItem label="Age" value={applicant.age != null ? `${applicant.age} yrs` : "—"} />
                      <DetailItem label="Sex" value={formatSex(applicant.sex)} />
                      <DetailItem label="Phone Contact" value={applicant.phone?.trim() || "—"} />
                      <DetailItem label="Level of education" value={applicant.education_level?.trim() || "—"} />
                      <DetailItem
                        label="Ghana Card (PIN)"
                        value={
                          ghanaCard ? <span className="font-mono">{displayGhanaCard(ghanaCard)}</span> : "—"
                        }
                      />
                      <DetailItem
                        label="NHIS Card Number"
                        value={nhis ? <span className="font-mono">{displayNhis(nhis)}</span> : "—"}
                      />
                      <DetailItem label="Occupation" value={applicant.occupation?.trim() || "—"} />
                      <DetailItem label="Town / Community" value={applicant.community_name?.trim() || "—"} />
                      <div className="sm:col-span-2">
                        <DetailItem label="Disability Classification" value={disabilityDisplay} />
                      </div>
                      <div className="sm:col-span-2 md:col-span-3">
                        <DetailItem label="Home Address" value={applicant.home_address?.trim() || "—"} />
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                /* PWD Direct Applicant Section */
                <section>
                      <SectionHeader title="Applicant Particulars" />
                      <div className="grid gap-5 sm:grid-cols-2">
                        <DetailItem label="Full Name" value={applicant.full_name} />
                        <DetailItem
                          label="Age / Sex"
                          value={`${applicant.age != null ? `${applicant.age} yrs` : "—"} · ${formatSex(applicant.sex)}`}
                        />
                        <DetailItem label="Phone Contact" value={applicant.phone?.trim() || "—"} />
                        <DetailItem label="Level of education" value={applicant.education_level?.trim() || "—"} />
                        <DetailItem
                          label="Ghana Card (PIN)"
                          value={
                            ghanaCard ? <span className="font-mono">{displayGhanaCard(ghanaCard)}</span> : "—"
                          }
                        />
                        <DetailItem
                          label="NHIS Card Number"
                          value={nhis ? <span className="font-mono">{displayNhis(nhis)}</span> : "—"}
                        />
                        <DetailItem label="Occupation" value={applicant.occupation?.trim() || "—"} />
                        <DetailItem
                          label="Residence Type"
                          value={formatResidenceType(applicant.residence_type, applicant.residence_other)}
                        />
                        <div className="sm:col-span-2">
                          <DetailItem label="Disability Classification" value={disabilityDisplay} />
                        </div>
                        <div className="sm:col-span-2">
                          <DetailItem label="Home Address" value={applicant.home_address?.trim() || "—"} />
                        </div>
                      </div>
                </section>
              )}

              {/* Membership */}
              <section>
                <SectionHeader title="Membership &amp; prior support" />
                <div className="grid gap-5 sm:grid-cols-2">
                  <DetailItem
                    label="OPD Membership"
                    value={
                      applicant.opd_member
                        ? `Yes ${applicant.opd_name?.trim() ? `(${applicant.opd_name.trim()})` : ""}`
                        : "No"
                    }
                  />
                  <DetailItem
                    label="Previous DACF Support"
                    value={
                      applicant.previous_fund
                        ? `Yes ${applicant.previous_fund_when?.trim() ? `(${applicant.previous_fund_when.trim()})` : ""}`
                        : "No"
                    }
                  />
                </div>
              </section>

              {/* Support captured at registration */}
              {applicant.registrationSupportIntake && (
                <section>
                  <SectionHeader title="Support from registration" />
                  <RegistrationIntakeSummary intake={applicant.registrationSupportIntake} compact className="mt-2" />
                </section>
              )}

              <ApplicantSupportHistoryTable
                className="border-t border-slate-200 pt-8"
                rows={applicant.applications ?? []}
                assistiveDeviceHistory={applicant.assistive_device_history}
              />
            </>
          )}
          </div>
        </div>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:gap-3 sm:px-8 sm:py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" tone="ghost" compact onClick={onClose}>
              Close
            </Button>
            {applicant && !loading && (
              <Button type="button" tone="ghost" compact onClick={() => window.print()}>
                Print
              </Button>
            )}
          </div>
          {proceedFlow ? (
            <Button
              type="button"
              tone="gold"
              compact
              disabled={!applicant || loading || completedThisYear}
              onClick={() => onProceedApplication?.()}
            >
              Proceed
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && applicant && (
                <Link to={`/applicants/${applicant.id}/edit`} onClick={onClose}>
                  <Button tone="ghost" compact>
                    Edit
                  </Button>
                </Link>
              )}
              {applied && currentYearApp && (
                <Button type="button" tone="ghost" compact onClick={() => setViewingApplicationId(currentYearApp.id)}>
                  View
                </Button>
              )}
              {canApply && (
                <Link to={`/apply?applicantId=${applicant!.id}`} onClick={onClose}>
                  <Button tone="gold" compact>
                    Apply
                  </Button>
                </Link>
              )}
            </div>
          )}
        </footer>
      </div>
      {viewingApplicationId && (
        <ApplicationViewModal applicationId={viewingApplicationId} onClose={() => setViewingApplicationId(null)} />
      )}
    </div>
    </>
  );
}
