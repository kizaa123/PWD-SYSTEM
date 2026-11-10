import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CATEGORY_LABELS, api, uploadApplicationDocument } from "../lib/api";
import { apiReachable, browserOnline, isLikelyNetworkError } from "../lib/connection";
import {
  readApplicantDetailCache,
  readApplicantsListCache,
  writeApplicantDetailCache,
  writeApplicantsListCache,
} from "../lib/applicantsCache";
import { readLookupsCache, writeLookupsCache } from "../lib/lookupsCache";
import {
  countPendingApplications,
  enqueuePendingApplication,
  fileToPayload,
} from "../lib/offlineDb";
import { notifyRegistrationQueueChanged } from "../lib/registrationSync";
import { formatAppDate } from "../lib/dateFormat";
import { disabilityFromRegistration } from "../lib/disabilityScheduleB";
import {
  APPLICATION_PURPOSE_CATEGORY_ORDER,
  EMPTY_PURPOSE_FORM,
  applicationPurposePrintRows,
  assistiveDeviceKeyFromPurposeForm,
  assistiveDeviceKeysFromHistory,
  buildDetailsFromPurposeForm,
  buildPurposeSummaryFromForm,
  validatePurposeForm,
  type AssistiveDeviceKey,
  type PrintRow,
  type PurposeFormState,
} from "../lib/supportPurposeOptions";
import { ApplicationPrintSheet } from "../components/ApplicationPrintSheet";
import { applicationDeclarationParts } from "../lib/applicationDeclaration";
import {
  ApplicationDeclarationBlock,
  EMPTY_DECLARATION,
  type DeclarationState,
} from "../components/ApplicationDeclarationBlock";
import { MedicalSupportDocumentField } from "../components/MedicalSupportDocumentField";
import { RegistrationIntakeSummary } from "../components/RegistrationIntakeSummary";
import { mergeApplicationSubmitDetails } from "../lib/applicationSubmitDetails";
import { applicationSupportTypeColumnLabel } from "../lib/applicationSupportDisplay";
import { isStartupToolPreviouslyRequested, type StartupToolHistoryRow } from "../lib/startupToolPolicy";
import {
  EDUCATION_SCHOOL_ACCOUNT_MESSAGE,
  EDUCATION_SCHOOL_NAME_MESSAGE,
  applicationRequiresEducationSchoolDetails,
} from "../lib/educationSupportPolicy";
import {
  MEDICAL_DOCUMENT_VALIDATION_MESSAGE,
  applicationRequiresMedicalDocument,
} from "../lib/healthSupportPolicy";
import { EducationSchoolApplyFields } from "../components/EducationSchoolApplyFields";
import { registrationIntakeDisplayRows } from "../lib/registrationIntakeDisplay";
import {
  PASSPORT_PHOTO_BOX_PRIMARY,
  PASSPORT_PHOTO_BOX_SECONDARY,
  PASSPORT_PHOTO_PRIMARY_CLASS,
  PASSPORT_PHOTO_SECONDARY_CLASS,
  RegisteredPassportPhoto,
} from "../components/RegisteredPassportPhoto";
import { isSubstantiveYearApplication, profileSupportYearClosed } from "../lib/applicantUtils";
import { purposeFormFromIntake, type RegistrationSupportIntake } from "../lib/registrationIntake";
import { SupportPurposeDetails } from "../components/SupportPurposeDetails";
import { FormFieldError, fieldErrorBorder } from "../components/FormFieldError";
import { ApplicantSupportHistoryTable } from "../components/ApplicantSupportHistoryTable";
import { useAuth } from "../lib/auth";
import { Button, Field, Money, ReferenceNumber, StatusBadge, inputClass } from "../components/StatusBadge";

function currentOfficerDisplayName(
  person: Record<string, unknown> | null,
  profile: Record<string, unknown> | null,
  userEmail: string | undefined,
): string {
  const fromPerson = typeof person?.full_name === "string" ? person.full_name.trim() : "";
  if (fromPerson) return fromPerson;
  const fromProfile = typeof profile?.full_name === "string" ? profile.full_name.trim() : "";
  if (fromProfile) return fromProfile;
  return userEmail?.trim() || "—";
}

type Lookups = {
  categories: { code: string; name: string; description: string }[];
  disabilities: string[];
};

type ApplicantListRow = {
  id: string;
  full_name: string;
  applicant_ref: string;
  phone: string | null;
  community_name: string | null;
  disability_category: string;
  ghana_card_masked: string;
  registration_type?: string;
  registration_source: string;
  registered_by_name: string | null;
  applied_current_year: boolean;
  application_year: number;
  created_at?: string;
};

type AppHistory = {
  id: string;
  reference: string;
  category_code: string;
  category_name: string;
  status: string;
  application_year: number;
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
  created_at: string;
  assistive_device_key: string | null;
  assistive_device_type: string | null;
};

type StartupToolHistory = StartupToolHistoryRow & { status?: string; created_at?: string };

type ApplicantDetail = {
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
  previous_fund: number;
  previous_fund_when: string | null;
  photo_path: string | null;
  caregiver_photo_path: string | null;
  registration_type: string;
  registered_by_name: string | null;
  applications: AppHistory[];
  assistive_device_history?: AssistiveDeviceHistory[];
  startup_tool_history?: StartupToolHistory[];
  registrationSupportIntake?: RegistrationSupportIntake | null;
  caregivers?: {
    full_name: string;
    phone: string | null;
    sex: string | null;
    age: number | null;
    home_address: string | null;
    email?: string | null;
    relationship: string;
    relationship_other: string | null;
    hours_of_caregiving: string | null;
    years_of_caregiving: string | null;
    education_level?: string | null;
    residence_type?: string | null;
    residence_other?: string | null;
    community_name?: string | null;
  }[];
};

function caregiverTownCommunity(
  caregiver: NonNullable<ApplicantDetail["caregivers"]>[number] | undefined,
  profileCommunity: string | null | undefined,
): string {
  const fromCaregiver = caregiver?.community_name?.trim();
  if (fromCaregiver) return fromCaregiver;
  return profileCommunity?.trim() || "—";
}

const CURRENT_APPLICATION_YEAR = new Date().getFullYear();

function DetailLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 py-1">
      <div className="text-xs font-medium leading-snug text-muted">{label}</div>
      <div className="mt-1.5 text-sm font-medium leading-relaxed text-navy">{value ?? "—"}</div>
    </div>
  );
}

function formatSex(sex: string | null | undefined) {
  if (!sex) return "—";
  return sex === "male" ? "Male" : sex === "female" ? "Female" : sex;
}

function formatResidenceType(type: string | null | undefined, other: string | null | undefined) {
  if (!type?.trim()) return "—";
  if (type === "Other" && other?.trim()) return other.trim();
  return type;
}

export function ApplicationNewPage() {
  const navigate = useNavigate();
  const { user, person, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get("applicantId") || "";
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [applicants, setApplicants] = useState<ApplicantListRow[]>([]);
  const [applicantProfileId, setApplicantProfileId] = useState(preselectedId);
  const [dossier, setDossier] = useState<ApplicantDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("");
  const [purposeForm, setPurposeForm] = useState<PurposeFormState>({ ...EMPTY_PURPOSE_FORM });
  const [purpose, setPurpose] = useState("");
  const [declaration, setDeclaration] = useState<DeclarationState>({ ...EMPTY_DECLARATION });
  const [medicalSupportFile, setMedicalSupportFile] = useState<File | null>(null);
  const [schoolLetterFile, setSchoolLetterFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    opdMember: "no",
    opdName: "",
  });
  const [registeredDisabilityDisplay, setRegisteredDisabilityDisplay] = useState("");
  const [disabilityUseSpecify, setDisabilityUseSpecify] = useState(false);
  const [disabilitySpecifyText, setDisabilitySpecifyText] = useState("");
  const [registeredIntake, setRegisteredIntake] = useState<RegistrationSupportIntake | null>(null);
  const [draftApplicationId, setDraftApplicationId] = useState<string | null>(null);
  const [completedLock, setCompletedLock] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [offlineInfo, setOfflineInfo] = useState("");

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function applyDossierData(data: ApplicantDetail) {
    const draft = data.applications.find(
      (a) =>
        a.application_year === CURRENT_APPLICATION_YEAR &&
        (a.status === "registration" || a.status === "returned_for_correction"),
    );
    setDraftApplicationId(draft?.id ?? null);
    setDossier(data);
    const draftQualifies = draft != null && !isSubstantiveYearApplication(draft);
    if (profileSupportYearClosed(data.applications, CURRENT_APPLICATION_YEAR) && !draftQualifies) {
      setCompletedLock(true);
      setError(
        `This applicant already has a ${CURRENT_APPLICATION_YEAR} support request on file. A new request can be opened next year.`,
      );
      return;
    }
    setCompletedLock(false);
    if (data.registrationSupportIntake) {
      const intake = data.registrationSupportIntake;
      setRegisteredIntake(intake);
      setCategory(intake.categoryCode);
      setPurposeForm(purposeFormFromIntake(intake));
    } else {
      setRegisteredIntake(null);
    }
    const scheduleB = lookups?.disabilities ?? readLookupsCache()?.disabilities ?? [];
    const disability = disabilityFromRegistration(data.disability_category, data.disability_other, scheduleB);
    setRegisteredDisabilityDisplay(disability.display);
    const hasRegisteredDisability = Boolean(disability.display);
    setDisabilityUseSpecify(!hasRegisteredDisability);
    setDisabilitySpecifyText(data.disability_other || "");
    setForm({
      opdMember: data.opd_member ? "yes" : "no",
      opdName: "",
    });
  }

  const purposeCategories = useMemo(() => {
    const list = lookups?.categories ?? [];
    const order = APPLICATION_PURPOSE_CATEGORY_ORDER as readonly string[];
    return [...list]
      .filter((c) => order.includes(c.code))
      .sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
  }, [lookups?.categories]);

  useEffect(() => {
    setPurposeForm({ ...EMPTY_PURPOSE_FORM });
    setMedicalSupportFile(null);
  }, [category]);

  useEffect(() => {
    if (!preselectedId) {
      navigate("/applications", { replace: true });
    }
  }, [preselectedId, navigate]);

  useEffect(() => {
    const cached = readLookupsCache();
    if (cached?.categories?.length) {
      setLookups({ categories: cached.categories, disabilities: cached.disabilities ?? [] });
    }
    api<Lookups>("/api/auth/lookups")
      .then((data) => {
        writeLookupsCache({
          disabilities: data.disabilities,
          categories: data.categories,
        });
        setLookups(data);
      })
      .catch(() => {
        if (cached?.categories?.length) setLookups({ categories: cached.categories, disabilities: cached.disabilities });
      });
  }, []);

  useEffect(() => {
    const cached = readApplicantsListCache<ApplicantListRow>();
    if (cached) setApplicants(cached);
    api<ApplicantListRow[]>("/api/applicants")
      .then((rows) => {
        writeApplicantsListCache(rows);
        setApplicants(rows);
      })
      .catch(() => {
        if (cached) setApplicants(cached);
      });
  }, []);

  useEffect(() => {
    if (!preselectedId) return;
    if (applicants.length) {
      const row = applicants.find((a) => a.id === preselectedId);
      if (row?.applied_current_year) {
        setApplicantProfileId("");
        setError(`This applicant already has a ${CURRENT_APPLICATION_YEAR} application on file.`);
        return;
      }
    }
    setApplicantProfileId(preselectedId);
  }, [preselectedId, applicants]);

  useEffect(() => {
    if (!applicantProfileId) {
      setDossier(null);
      setCompletedLock(false);
      setRegisteredDisabilityDisplay("");
      setDisabilityUseSpecify(false);
      setDisabilitySpecifyText("");
      return;
    }
    setLoading(true);
    setError("");
    const cachedDetail = readApplicantDetailCache<ApplicantDetail>(applicantProfileId);
    if (cachedDetail) {
      applyDossierData(cachedDetail);
      setLoading(false);
    }
    api<ApplicantDetail>(`/api/applicants/${applicantProfileId}`)
      .then((data) => {
        writeApplicantDetailCache(applicantProfileId, data);
        applyDossierData(data);
      })
      .catch((e) => {
        if (cachedDetail) return;
        if (isLikelyNetworkError(e)) {
          setError("Applicant details are not cached on this device. Open this record once while online.");
          return;
        }
        setDossier(null);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [applicantProfileId, lookups?.disabilities, navigate]);

  const assistiveDeviceHistory = dossier?.assistive_device_history ?? [];
  const startupToolHistory = dossier?.startup_tool_history ?? [];

  const previouslyAppliedDeviceKeys = useMemo(
    () => assistiveDeviceKeysFromHistory(assistiveDeviceHistory),
    [assistiveDeviceHistory],
  );

  const effectiveCategory = registeredIntake?.categoryCode ?? category;

  const requiresMedicalDocument = useMemo(
    () => applicationRequiresMedicalDocument(effectiveCategory, registeredIntake),
    [effectiveCategory, registeredIntake, category],
  );

  const requiresEducationSchool = useMemo(
    () =>
      applicationRequiresEducationSchoolDetails(effectiveCategory, registeredIntake, {
        educationTrack: purposeForm.educationTrack,
        educationalSupportType: purposeForm.educationalSupportType,
      }),
    [
      effectiveCategory,
      registeredIntake,
      category,
      purposeForm.educationTrack,
      purposeForm.educationalSupportType,
    ],
  );

  useEffect(() => {
    if (!requiresMedicalDocument) setMedicalSupportFile(null);
  }, [requiresMedicalDocument]);

  useEffect(() => {
    if (!requiresEducationSchool) setSchoolLetterFile(null);
  }, [requiresEducationSchool]);

  const registrationEndorsedByName = dossier?.registered_by_name?.trim() || "—";
  const applicationEndorsedByName = currentOfficerDisplayName(person, profile, user?.email);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!applicantProfileId || !dossier) {
      setError("Select an applicant first so their details can be loaded.");
      return;
    }
    if (completedLock || profileSupportYearClosed(dossier.applications, CURRENT_APPLICATION_YEAR)) {
      setError(
        `This applicant already completed a ${CURRENT_APPLICATION_YEAR} support request. A new request can be opened next year.`,
      );
      return;
    }

    const err: Record<string, string> = {};
    if (disabilityUseSpecify && !disabilitySpecifyText.trim()) {
      err.disabilitySpecify = "Specify the type of disability under Schedule B, or use the registration record.";
    }
    const requestedDeviceKey = assistiveDeviceKeyFromPurposeForm(category, purposeForm);
    if (
      requestedDeviceKey &&
      previouslyAppliedDeviceKeys.includes(requestedDeviceKey as AssistiveDeviceKey)
    ) {
      setError("This device has been requested before and cannot be applied for again.");
      return;
    }
    if (
      category === "income_generating" &&
      purposeForm.incomeSupportType === "startup_tool" &&
      isStartupToolPreviouslyRequested(purposeForm.itemSpecification, startupToolHistory)
    ) {
      setError("This start-up tool has been requested before and cannot be applied for again.");
      return;
    }
    if (!registeredIntake) {
      if (!category) {
        err.category = "Select the category of support being requested this year.";
      } else {
        const purposeError = validatePurposeForm(category, purposeForm);
        if (purposeError) err.purpose = purposeError;
      }
    }
    if (requiresEducationSchool) {
      if (!purposeForm.schoolName.trim()) err.schoolName = EDUCATION_SCHOOL_NAME_MESSAGE;
      if (!purposeForm.schoolAccountNumber.trim()) err.schoolAccountNumber = EDUCATION_SCHOOL_ACCOUNT_MESSAGE;
    }
    if (!declaration.signatureMode) err.signatureMode = "Select Signature or Thumbprint.";
    if (requiresMedicalDocument && !medicalSupportFile) {
      err.medicalDocument = MEDICAL_DOCUMENT_VALIDATION_MESSAGE;
    }
    if (!declaration.officeUseQualified) {
      err.officeUseQualified = "Select Qualified or Not Qualified.";
    }

    setFieldErrors(err);
    if (Object.keys(err).length > 0) {
      setError("Please correct the fields marked below.");
      const first = Object.keys(err)[0];
      document.getElementById(`apply-field-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError("");
    setOfflineInfo("");
    setBusy(true);
    const otherScheduleB =
      lookups?.disabilities.find((d) => d.startsWith("Other")) || "Other (specify)";
    const patchBody: Record<string, unknown> = {
      opdMember: form.opdMember === "yes",
      opdName: form.opdMember === "yes" ? form.opdName : "",
    };
    if (disabilityUseSpecify) {
      patchBody.disabilityCategory = otherScheduleB;
      patchBody.disabilityOther = disabilitySpecifyText.trim();
    }
    const submitCategory = registeredIntake?.categoryCode || category;
    const categoryLabel =
      registeredIntake?.categoryLabel ||
      purposeCategories.find((c) => c.code === category)?.name ||
      CATEGORY_LABELS[category] ||
      category;
    const autoSummary = registeredIntake
      ? registeredIntake.purposeSummarySeed
      : buildPurposeSummaryFromForm(category, categoryLabel, purposeForm);
    const notes = purpose.trim();
    const purposeSummary = notes ? `${autoSummary} — ${notes}` : autoSummary;
    const requestBody = {
      categoryCode: submitCategory,
      amountRequested: null,
      purposeSummary,
      applicantSignatureLabel: declaration.signatureMode === "thumbprint" ? "Thumbprint" : "Signature",
      endorsingOfficerName: applicationEndorsedByName === "—" ? null : applicationEndorsedByName,
      officeUseQualified: declaration.officeUseQualified,
      officeUseRemarks: declaration.officeUseRemarks.trim(),
      details: mergeApplicationSubmitDetails({ registeredIntake, category, purposeForm }),
    };

    async function saveOfflineApplication() {
      const documents: { documentType: string; fileName: string; mimeType: string; base64: string }[] = [];
      if (requiresMedicalDocument && medicalSupportFile) {
        documents.push({ documentType: "medical_receipt", ...(await fileToPayload(medicalSupportFile)) });
      }
      if (requiresEducationSchool && schoolLetterFile) {
        documents.push({ documentType: "admission_letter", ...(await fileToPayload(schoolLetterFile)) });
      }
      await enqueuePendingApplication({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: "pending",
        applicantProfileId,
        draftApplicationId,
        patchBody,
        requestBody,
        documents,
        label: dossier?.full_name || "Application",
      });
      const n = await countPendingApplications();
      notifyRegistrationQueueChanged();
      setOfflineInfo(n > 0 ? `Saved on this device (${n} application(s) waiting to sync).` : "Saved on this device.");
      navigate("/applications");
    }

    try {
      const reachable = browserOnline() && (await apiReachable());
      if (!reachable) {
        await saveOfflineApplication();
        return;
      }
      await api(`/api/applicants/${applicantProfileId}`, {
        method: "PATCH",
        body: JSON.stringify(patchBody),
      });
      const saved = draftApplicationId
        ? await api<{ id: string }>(`/api/applications/${draftApplicationId}`, {
            method: "PATCH",
            body: JSON.stringify(requestBody),
          })
        : await api<{ id: string }>("/api/applications", {
            method: "POST",
            body: JSON.stringify({ applicantProfileId, ...requestBody }),
          });
      if (requiresMedicalDocument && medicalSupportFile) {
        await uploadApplicationDocument(saved.id, medicalSupportFile, "medical_receipt");
      }
      if (requiresEducationSchool && schoolLetterFile) {
        await uploadApplicationDocument(saved.id, schoolLetterFile, "admission_letter");
      }
      navigate("/applications");
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        try {
          await saveOfflineApplication();
          return;
        } catch (queueErr) {
          setError((queueErr as Error).message);
          return;
        }
      }
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const declarationParts = applicationDeclarationParts({
    registrationType: dossier?.registration_type,
    relationship: dossier?.caregivers?.[0]?.relationship,
    beneficiaryName: dossier?.full_name,
  });
  const declarationSentence = `${declarationParts.before}${declarationParts.beneficiaryName ?? ""}${declarationParts.after}`;

  const applicationOpenedAt = formatAppDate(new Date());

  const printSnapshot = useMemo(() => {
    if (!dossier) return null;
    const categoryLabel =
      registeredIntake?.categoryLabel ||
      purposeCategories.find((c) => c.code === category)?.name ||
      CATEGORY_LABELS[category] ||
      category;
    const disabilityValue = disabilityUseSpecify
      ? disabilitySpecifyText.trim() || "—"
      : registeredDisabilityDisplay || "—";
    const purposeRows: PrintRow[] = registeredIntake
      ? registrationIntakeDisplayRows(registeredIntake).map((r) => ({ label: r.label, value: r.value }))
      : [
          { label: "Support category", value: categoryLabel || "—" },
          ...applicationPurposePrintRows(category, purposeForm),
        ];
    if (purpose.trim()) purposeRows.push({ label: "Additional notes", value: purpose.trim() });
    const summarySeed = registeredIntake?.purposeSummarySeed ?? buildPurposeSummaryFromForm(category, categoryLabel, purposeForm);
    purposeRows.push({
      label: "Type of support",
      value: applicationSupportTypeColumnLabel(
        category,
        categoryLabel,
        summarySeed,
        registeredIntake ? undefined : buildDetailsFromPurposeForm(category, purposeForm),
      ),
    });
    if (requiresMedicalDocument) {
      purposeRows.push({
        label: "Hospital medical document",
        value: medicalSupportFile?.name ?? "—",
      });
    }
    if (requiresEducationSchool) {
      purposeRows.push({ label: "School name", value: purposeForm.schoolName.trim() || "—" });
      purposeRows.push({
        label: "School account No.",
        value: purposeForm.schoolAccountNumber.trim() || "—",
      });
      if (schoolLetterFile) {
        purposeRows.push({ label: "Letter from school", value: schoolLetterFile.name });
      }
    }

    const sections = [
      {
        title: "Application & location",
        rows: [
          { label: "Date of application", value: applicationOpenedAt },
          { label: "Applicant number", value: dossier.applicant_ref },
          { label: "Region", value: dossier.region_name },
          { label: "District", value: dossier.district_name },
          { label: "Town or community", value: dossier.community_name?.trim() || "—" },
        ],
      },
      ...(dossier.registration_type === "caregiver"
        ? [
            {
              title: "Caregiver",
              rows: [
                { label: "Name", value: dossier.caregivers?.[0]?.full_name || "—" },
                { label: "Age", value: dossier.caregivers?.[0]?.age != null ? String(dossier.caregivers[0].age) : "—" },
                { label: "Sex", value: formatSex(dossier.caregivers?.[0]?.sex ?? null) },
                { label: "Contact", value: dossier.caregivers?.[0]?.phone?.trim() || "—" },
                { label: "Home address", value: dossier.caregivers?.[0]?.home_address?.trim() || "—" },
                { label: "Level of education", value: dossier.caregivers?.[0]?.education_level?.trim() || "—" },
                {
                  label: "Type of residence",
                  value: formatResidenceType(
                    dossier.caregivers?.[0]?.residence_type,
                    dossier.caregivers?.[0]?.residence_other,
                  ),
                },
                {
                  label: "Relationship to beneficiary",
                  value:
                    dossier.caregivers?.[0]?.relationship === "Other"
                      ? dossier.caregivers?.[0]?.relationship_other?.trim() || "Other"
                      : dossier.caregivers?.[0]?.relationship || "—",
                },
                {
                  label: "Hours of caregiving per day",
                  value: dossier.caregivers?.[0]?.hours_of_caregiving?.trim() || "—",
                },
                {
                  label: "Years of caregiving",
                  value: dossier.caregivers?.[0]?.years_of_caregiving?.trim() || "—",
                },
              ],
            },
            {
              title: "Beneficiary (person receiving care)",
              rows: [
                { label: "Name", value: dossier.full_name },
                { label: "Age", value: dossier.age != null ? String(dossier.age) : "—" },
                { label: "Sex", value: formatSex(dossier.sex) },
                { label: "Education", value: dossier.education_level?.trim() || "—" },
                { label: "Occupation", value: dossier.occupation?.trim() || "—" },
                { label: "Contact", value: dossier.phone?.trim() || "—" },
                { label: "Home address", value: dossier.home_address?.trim() || "—" },
              ],
            },
          ]
        : [
            {
              title: "Personal details",
              rows: [
                { label: "Name of applicant", value: dossier.full_name },
                { label: "Age", value: dossier.age != null ? String(dossier.age) : "—" },
                { label: "Sex", value: formatSex(dossier.sex) },
                { label: "Occupation", value: dossier.occupation?.trim() || "—" },
                { label: "Contact", value: dossier.phone?.trim() || "—" },
                { label: "Home address", value: dossier.home_address?.trim() || "—" },
                { label: "Education level", value: dossier.education_level?.trim() || "—" },
              ],
            },
          ]),
      {
        title: "Disability & OPD membership",
        rows: [
          { label: "Type of disability", value: disabilityValue },
          {
            label: "Member of OPD",
            value:
              form.opdMember === "yes"
                ? `Yes${form.opdName.trim() ? ` — ${form.opdName.trim()}` : ""}`
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
              declaration.officeUseQualified === "qualified"
                ? "Qualified"
                : declaration.officeUseQualified === "not_qualified"
                  ? "Not Qualified"
                  : "—",
          },
          { label: "Additional remarks", value: declaration.officeUseRemarks.trim() || "—" },
        ],
      },
    ];
    const isCaregiverReg = dossier.registration_type === "caregiver";
    const primaryPhoto = isCaregiverReg
      ? {
          applicantProfileId: dossier.id,
          subject: "caregiver" as const,
          photoPath: dossier.caregiver_photo_path ?? null,
          caption: "Caregiver passport photo",
        }
      : dossier.photo_path
        ? {
            applicantProfileId: dossier.id,
            subject: "beneficiary" as const,
            photoPath: dossier.photo_path,
            caption: "Applicant passport photo",
          }
        : null;
    const secondaryPhoto =
      isCaregiverReg && dossier.photo_path
        ? {
            applicantProfileId: dossier.id,
            subject: "beneficiary" as const,
            photoPath: dossier.photo_path,
            caption: "Beneficiary passport photo",
          }
        : null;

    return {
      documentTitle: "PWD Care Fund — Support Application",
      applicationTypeLabel: isCaregiverReg ? "Caregiver support application" : "PWD support application",
      applicantRef: dossier.applicant_ref,
      printedAt: formatAppDate(new Date()),
      declaration: declarationSentence,
      registrationEndorsedByName: dossier.registered_by_name?.trim() || "",
      applicationEndorsedByName,
      applicantSignatureMode: declaration.signatureMode,
      primaryPhoto,
      secondaryPhoto,
      sections,
    };
  }, [
    dossier,
    applicationOpenedAt,
    purposeCategories,
    category,
    disabilityUseSpecify,
    disabilitySpecifyText,
    registeredDisabilityDisplay,
    form.opdMember,
    form.opdName,
    purposeForm,
    purpose,
    medicalSupportFile,
    registeredIntake,
    requiresMedicalDocument,
    requiresEducationSchool,
    schoolLetterFile,
    declaration,
    declarationSentence,
    applicationEndorsedByName,
  ]);

  return (
    <form onSubmit={onSubmit} className="registration-form-mobile mx-auto max-w-4xl space-y-4">
      {printSnapshot ? <ApplicationPrintSheet snapshot={printSnapshot} /> : null}
      {error && (
        <div className="no-print rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {loading && <p className="no-print text-sm text-muted">Loading applicant details…</p>}

      {dossier && !loading && !completedLock && (
        <div className="application-form-screen space-y-4">
          <div className="space-y-8 rounded-2xl bg-surface p-4 shadow-sm sm:p-6 md:p-8">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-navy sm:text-lg">
                  Applicant particulars{dossier.registration_type === "caregiver" ? " (Caregiver)" : ""}
                </h3>
                <p className="mt-1 text-xs text-muted sm:text-sm">From the register — confirm before completing the application.</p>
              </div>
              <div className="flex shrink-0 items-start gap-1.5 sm:gap-2">
                {dossier.registration_type === "caregiver" ? (
                  <>
                    <RegisteredPassportPhoto
                      applicantProfileId={dossier.id}
                      subject="caregiver"
                      size="xs"
                      align="end"
                      photoPath={dossier.caregiver_photo_path}
                      className="sm:hidden"
                    />
                    <RegisteredPassportPhoto
                      applicantProfileId={dossier.id}
                      subject="caregiver"
                      size="small"
                      align="end"
                      photoPath={dossier.caregiver_photo_path}
                      className={`hidden sm:block ${PASSPORT_PHOTO_PRIMARY_CLASS}`}
                      boxMaxWidthClass={PASSPORT_PHOTO_BOX_PRIMARY}
                    />
                    {dossier.photo_path ? (
                      <>
                        <RegisteredPassportPhoto
                          applicantProfileId={dossier.id}
                          subject="beneficiary"
                          size="xs"
                          align="end"
                          photoPath={dossier.photo_path}
                          className="sm:hidden"
                        />
                        <RegisteredPassportPhoto
                          applicantProfileId={dossier.id}
                          subject="beneficiary"
                          size="small"
                          align="end"
                          photoPath={dossier.photo_path}
                          className={`hidden sm:block ${PASSPORT_PHOTO_SECONDARY_CLASS}`}
                          boxMaxWidthClass={PASSPORT_PHOTO_BOX_SECONDARY}
                        />
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <RegisteredPassportPhoto
                      applicantProfileId={dossier.id}
                      subject="beneficiary"
                      size="xs"
                      align="end"
                      photoPath={dossier.photo_path}
                      className="sm:hidden"
                    />
                    <RegisteredPassportPhoto
                      applicantProfileId={dossier.id}
                      subject="beneficiary"
                      size="small"
                      align="end"
                      photoPath={dossier.photo_path}
                      className={`hidden sm:block ${PASSPORT_PHOTO_PRIMARY_CLASS}`}
                      boxMaxWidthClass={PASSPORT_PHOTO_BOX_PRIMARY}
                    />
                  </>
                )}
              </div>
            </div>

            {(() => {
              const isCaregiverReg = dossier.registration_type === "caregiver";
              const caregiver = dossier.caregivers?.[0];
              const relationshipLabel = caregiver
                ? caregiver.relationship === "Other" && caregiver.relationship_other?.trim()
                  ? caregiver.relationship_other.trim()
                  : caregiver.relationship
                : "—";

              const disabilityBlock = (
                <div className="space-y-4">
                  <div className="text-xs font-medium leading-snug text-muted">Type of disability (Schedule B)</div>
                  {!disabilityUseSpecify && (
                    <div className="text-sm font-medium leading-relaxed text-navy">
                      {registeredDisabilityDisplay || "Not recorded at registration"}
                    </div>
                  )}
                  {disabilityUseSpecify && disabilitySpecifyText.trim() && (
                    <div className="text-sm font-medium leading-relaxed text-navy">{disabilitySpecifyText.trim()}</div>
                  )}
                  <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1 text-sm">
                    {registeredDisabilityDisplay && (
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          type="radio"
                          name="disabilitySource"
                          checked={!disabilityUseSpecify}
                          onChange={() => setDisabilityUseSpecify(false)}
                        />
                        From registration
                      </label>
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="disabilitySource"
                        checked={disabilityUseSpecify}
                        onChange={() => setDisabilityUseSpecify(true)}
                      />
                      If not specified type
                    </label>
                  </div>
                  {disabilityUseSpecify && (
                    <div className="max-w-md pt-1" id="apply-field-disabilitySpecify">
                      <label className="mb-2 block text-xs font-medium text-muted">
                        Specify type (saved to applicant record)
                      </label>
                      <input
                        className={fieldErrorBorder(Boolean(fieldErrors.disabilitySpecify), inputClass)}
                        value={disabilitySpecifyText}
                        onChange={(e) => {
                          setDisabilitySpecifyText(e.target.value);
                          setFieldErrors((prev) => {
                            if (!prev.disabilitySpecify) return prev;
                            const next = { ...prev };
                            delete next.disabilitySpecify;
                            return next;
                          });
                        }}
                        placeholder="Type disability category"
                      />
                      <FormFieldError message={fieldErrors.disabilitySpecify} />
                    </div>
                  )}
                </div>
              );

              return (
                <>
                  <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                    <DetailLine label="Date of application" value={applicationOpenedAt} />
                    <DetailLine label="Applicant number" value={<ReferenceNumber>{dossier.applicant_ref}</ReferenceNumber>} />
                    <DetailLine label="Name of region" value={dossier.region_name} />
                    <DetailLine label="Name of district" value={dossier.district_name} />
                  </div>

                  {isCaregiverReg ? (
                    <div className="space-y-10 border-t border-canvas pt-8">
                      <div>
                        <h4 className="text-sm font-bold uppercase tracking-wide text-teal">Caregiver</h4>
                        <div className="mt-4">
                          <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                            <DetailLine label="Name of caregiver" value={caregiver?.full_name || "—"} />
                            <DetailLine label="Age" value={caregiver?.age != null ? String(caregiver.age) : "—"} />
                            <DetailLine label="Sex" value={formatSex(caregiver?.sex ?? null)} />
                            <DetailLine label="Contact" value={caregiver?.phone?.trim() || "—"} />
                            <DetailLine
                              label="Name of town or community"
                              value={caregiverTownCommunity(caregiver, dossier.community_name)}
                            />
                            <DetailLine label="Home address" value={caregiver?.home_address?.trim() || "—"} />
                            <DetailLine label="Level of education" value={caregiver?.education_level?.trim() || "—"} />
                            <DetailLine
                              label="Type of residence"
                              value={formatResidenceType(caregiver?.residence_type, caregiver?.residence_other)}
                            />
                            <DetailLine label="Relationship to beneficiary" value={relationshipLabel} />
                            <DetailLine
                              label="Hours of caregiving per day"
                              value={caregiver?.hours_of_caregiving?.trim() || "—"}
                            />
                            <DetailLine label="Years of caregiving" value={caregiver?.years_of_caregiving?.trim() || "—"} />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-canvas pt-8">
                        <h4 className="text-sm font-bold uppercase tracking-wide text-teal">Beneficiary (person receiving care)</h4>
                        <div className="mt-4 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                          <DetailLine label="Name of beneficiary" value={dossier.full_name} />
                          <DetailLine label="Age" value={dossier.age != null ? String(dossier.age) : "—"} />
                          <DetailLine label="Sex" value={formatSex(dossier.sex)} />
                          <DetailLine label="Level of education" value={dossier.education_level || "—"} />
                          <DetailLine label="Occupation (if any)" value={dossier.occupation || "—"} />
                          <DetailLine label="Contact" value={dossier.phone || "—"} />
                          <div className="sm:col-span-2">
                            <DetailLine label="Home address" value={dossier.home_address || "—"} />
                          </div>
                          <DetailLine label="Registered by" value={registrationEndorsedByName} />
                        </div>
                        <div className="mt-6 border-t border-canvas pt-6">{disabilityBlock}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8 border-t border-canvas pt-8">
                        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                          <DetailLine label="Name of applicant" value={dossier.full_name} />
                          <DetailLine label="Age" value={dossier.age != null ? String(dossier.age) : "—"} />
                          <DetailLine label="Sex" value={formatSex(dossier.sex)} />
                          <DetailLine label="Occupation (if any)" value={dossier.occupation || "—"} />
                          <DetailLine label="Contact" value={dossier.phone || "—"} />
                          <DetailLine label="Name of town or community" value={dossier.community_name || "—"} />
                          <div className="sm:col-span-2">
                            <DetailLine label="Home address" value={dossier.home_address || "—"} />
                          </div>
                          <DetailLine label="Registered by" value={registrationEndorsedByName} />
                        </div>
                        <div className="border-t border-canvas pt-8">{disabilityBlock}</div>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="space-y-4 border-t border-canvas pt-8">
              <div>
                <div className="text-xs font-medium leading-snug text-muted">
                  Are you a member of any OPDs (organization)?
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked={form.opdMember === "yes"} onChange={() => set("opdMember", "yes")} />{" "}
                    Yes
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" checked={form.opdMember === "no"} onChange={() => set("opdMember", "no")} /> No
                  </label>
                </div>
              </div>
              {form.opdMember === "yes" && (
                <div className="max-w-md pt-1">
                  <Field label="If yes, name the organization">
                    <input className={inputClass} value={form.opdName} onChange={(e) => set("opdName", e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl bg-surface p-6 shadow-sm">
            <div className="space-y-3 text-sm text-navy">
              <div>
                <div className="font-semibold">Application:</div>
                <p className="mt-1 leading-relaxed">
                  {declarationParts.before}
                  {declarationParts.beneficiaryName && applicantProfileId ? (
                    <Link
                      to={`/applicants?view=${encodeURIComponent(applicantProfileId)}`}
                      className="font-semibold text-teal hover:underline"
                      title="View beneficiary details"
                    >
                      {declarationParts.beneficiaryName}
                    </Link>
                  ) : (
                    declarationParts.beneficiaryName
                  )}
                  {declarationParts.after}
                </p>
              </div>
              <div className="font-semibold">Purpose:</div>
            </div>
            <div className="space-y-4">
              {registeredIntake ? <RegistrationIntakeSummary intake={registeredIntake} /> : (
                <>
                  <Field label="Support category for this year">
                    <div id="apply-field-category">
                      <select
                        className={fieldErrorBorder(Boolean(fieldErrors.category), inputClass)}
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value);
                          setFieldErrors((prev) => {
                            if (!prev.category) return prev;
                            const next = { ...prev };
                            delete next.category;
                            return next;
                          });
                        }}
                      >
                        <option value="">Select support category</option>
                        {purposeCategories.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <FormFieldError message={fieldErrors.category} />
                    </div>
                  </Field>
                  <div id="apply-field-purpose">
                    <SupportPurposeDetails
                      categoryCode={category}
                      value={purposeForm}
                      onChange={(v) => {
                        setPurposeForm(v);
                        setFieldErrors((prev) => {
                          if (!prev.purpose) return prev;
                          const next = { ...prev };
                          delete next.purpose;
                          return next;
                        });
                      }}
                      previouslyAppliedDeviceKeys={previouslyAppliedDeviceKeys}
                      startupToolHistory={startupToolHistory}
                    />
                    <FormFieldError message={fieldErrors.purpose} />
                  </div>
                </>
              )}
              {requiresEducationSchool ? (
                <EducationSchoolApplyFields
                  schoolName={purposeForm.schoolName}
                  schoolAccountNumber={purposeForm.schoolAccountNumber}
                  onSchoolNameChange={(v) => {
                    setPurposeForm((prev) => ({ ...prev, schoolName: v }));
                    setFieldErrors((prev) => {
                      if (!prev.schoolName) return prev;
                      const next = { ...prev };
                      delete next.schoolName;
                      return next;
                    });
                  }}
                  onSchoolAccountNumberChange={(v) => {
                    setPurposeForm((prev) => ({ ...prev, schoolAccountNumber: v }));
                    setFieldErrors((prev) => {
                      if (!prev.schoolAccountNumber) return prev;
                      const next = { ...prev };
                      delete next.schoolAccountNumber;
                      return next;
                    });
                  }}
                  schoolNameError={fieldErrors.schoolName}
                  schoolAccountNumberError={fieldErrors.schoolAccountNumber}
                  letterFile={schoolLetterFile}
                  onLetterFileChange={setSchoolLetterFile}
                />
              ) : null}
              {requiresMedicalDocument ? (
                <div id="apply-field-medicalDocument" className="max-w-md">
                  <MedicalSupportDocumentField
                    file={medicalSupportFile}
                    onChange={(f) => {
                      setMedicalSupportFile(f);
                      setFieldErrors((prev) => {
                        if (!prev.medicalDocument) return prev;
                        const next = { ...prev };
                        delete next.medicalDocument;
                        return next;
                      });
                    }}
                    error={fieldErrors.medicalDocument}
                  />
                </div>
              ) : null}
              <Field label="Additional notes (optional)">
                <textarea className={inputClass} rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              </Field>
            </div>

            <ApplicationDeclarationBlock
              value={declaration}
              onChange={(next) => {
                const changed = Object.keys(next).filter(
                  (k) => next[k as keyof DeclarationState] !== declaration[k as keyof DeclarationState],
                );
                setDeclaration(next);
                setFieldErrors((prev) => {
                  const hit = changed.filter((k) => prev[k]);
                  if (hit.length === 0) return prev;
                  const copy = { ...prev };
                  for (const k of hit) delete copy[k];
                  return copy;
                });
              }}
              errors={fieldErrors}
            />

          </div>

          <div className="no-print mt-8 flex flex-wrap gap-2 rounded-2xl bg-surface px-4 py-4 shadow-sm sm:gap-3 sm:px-6 sm:py-5">
            <Button
              compact
              disabled={busy}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button type="button" tone="ghost" compact onClick={() => window.print()}>
              Print
            </Button>
          </div>

        </div>
      )}

      {dossier && !loading && !completedLock && (
        <div className="no-print mt-8 rounded-2xl border border-slate-200 bg-surface p-6 shadow-sm">
          <ApplicantSupportHistoryTable
            title="Applicant support history"
            rows={dossier.applications ?? []}
            assistiveDeviceHistory={assistiveDeviceHistory}
            startupToolHistory={startupToolHistory}
            emptyMessage="No previous yearly requests on file for this applicant."
          />
        </div>
      )}
    </form>
  );
}
