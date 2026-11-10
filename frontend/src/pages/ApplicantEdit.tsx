import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EducationLevelSelect } from "../components/EducationLevelSelect";
import { educationLevelForSubmit, parseEducationLevelForForm } from "../lib/educationLevels";
import { GhanaCardInput } from "../components/GhanaCardInput";
import { NhisInput } from "../components/NhisInput";
import { PhoneInput } from "../components/PhoneInput";
import { PassportPhotoField } from "../components/PassportPhotoField";
import {
  CAREGIVER_PURPOSE_OPTIONS,
  CAREGIVER_RELATIONSHIP_OPTIONS,
  Field,
  RadioGroup,
  RESIDENCE_OPTIONS,
} from "../components/RegistrationFormUi";
import { api, uploadApplicantPassportPhoto } from "../lib/api";
import { disabilityFromRegistration } from "../lib/disabilityScheduleB";
import { formatAppDateFromIso } from "../lib/dateFormat";
import { FormFieldError, fieldErrorBorder } from "../components/FormFieldError";
import { displayGhanaCard, formatGhanaCard, ghanaCardValidationError } from "../lib/ghanaCardFormat";
import { formatGhanaPhone, phoneValidationError } from "../lib/ghanaPhoneFormat";
import { formatNhis, nhisValidationError } from "../lib/nhisFormat";
import { inputClass } from "../components/StatusBadge";
import { PageTitle } from "../components/PageTitle";

type Lookups = { disabilities: string[] };

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
  community_name?: string | null;
  status: string;
  education_level?: string | null;
  residence_type?: string | null;
  residence_other?: string | null;
};

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
  residence_type: string | null;
  residence_other: string | null;
  disability_category: string | null;
  disability_other: string | null;
  opd_member: number;
  opd_name: string | null;
  previous_fund: number;
  previous_fund_when: string | null;
  registration_type: string;
  photo_path: string | null;
  caregiver_photo_path: string | null;
  created_at: string;
  identifiers: { id_type: string; value_normalized: string }[];
  caregivers: (CaregiverRow & { caregiver_ghana_card?: string | null })[];
  registrationSupportIntake?: { applicationDetails?: Record<string, unknown>; purposeForm?: Record<string, unknown> } | null;
};

type FormState = Record<string, string>;

const emptyForm: FormState = {
  communityName: "",
  fullName: "",
  ghanaCard: "",
  nhisNumber: "",
  phone: "",
  sex: "female",
  age: "",
  homeAddress: "",
  disabilityCategory: "",
  disabilityOther: "",
  occupation: "",
  educationLevel: "",
  educationLevelOther: "",
  residenceType: "",
  residenceOther: "",
  caregiverName: "",
  caregiverAge: "",
  caregiverSex: "female",
  caregiverEducationLevel: "",
  caregiverEducationLevelOther: "",
  caregiverHomeAddress: "",
  caregiverCommunityName: "",
  caregiverPhone: "",
  caregiverGhanaCard: "",
  caregiverResidenceType: "",
  caregiverResidenceOther: "",
  caregiverRelationship: "",
  caregiverRelationshipOther: "",
  hoursOfCaregiving: "",
  yearsOfCaregiving: "",
  caregiverPurpose: "",
  caregiverPurposeOther: "",
  supportingInfo: "",
};

function str(v: unknown): string {
  if (v == null) return "";
  return String(v);
}

function applicantToForm(a: ApplicantDetail, scheduleB: string[]): FormState {
  const dis = disabilityFromRegistration(a.disability_category, a.disability_other, scheduleB);
  const ghana = a.identifiers.find((i) => i.id_type === "ghana_card")?.value_normalized ?? "";
  const nhis = a.identifiers.find((i) => i.id_type === "nhis")?.value_normalized ?? "";
  const cg = a.caregivers.find((c) => c.status === "active") ?? a.caregivers[0];
  const intake = a.registrationSupportIntake;
  const det = (intake?.applicationDetails ?? {}) as Record<string, string>;
  const pf = (intake?.purposeForm ?? {}) as Record<string, string>;

  const caregiverGhana = str(cg?.caregiver_ghana_card);

  return {
    ...emptyForm,
    communityName: a.community_name ?? "",
    fullName: a.full_name ?? "",
    ghanaCard: formatGhanaCard(ghana) || displayGhanaCard(ghana),
    nhisNumber: formatNhis(nhis) || nhis,
    phone: formatGhanaPhone(a.phone ?? ""),
    sex: a.sex === "male" ? "male" : "female",
    age: a.age != null ? String(a.age) : "",
    homeAddress: a.home_address ?? "",
    disabilityCategory: dis.category,
    disabilityOther: dis.other,
    occupation: a.occupation ?? "",
    ...(() => {
      const ed = parseEducationLevelForForm(a.education_level);
      return { educationLevel: ed.level, educationLevelOther: ed.other };
    })(),
    residenceType: a.residence_type || "",
    residenceOther: a.residence_other ?? "",
    caregiverName: cg?.full_name ?? "",
    caregiverAge: cg?.age != null ? String(cg.age) : "",
    caregiverSex: cg?.sex === "male" ? "male" : "female",
    ...(() => {
      const ed = parseEducationLevelForForm(cg?.education_level);
      return { caregiverEducationLevel: ed.level, caregiverEducationLevelOther: ed.other };
    })(),
    caregiverHomeAddress: cg?.home_address ?? "",
    caregiverCommunityName: cg?.community_name?.trim() || a.community_name?.trim() || "",
    caregiverPhone: formatGhanaPhone(cg?.phone ?? ""),
    caregiverGhanaCard: formatGhanaCard(caregiverGhana) || displayGhanaCard(caregiverGhana),
    caregiverResidenceType: cg?.residence_type || "",
    caregiverResidenceOther: cg?.residence_other ?? "",
    caregiverRelationship: cg?.relationship ?? "",
    caregiverRelationshipOther: cg?.relationship_other ?? "",
    hoursOfCaregiving: cg?.hours_of_caregiving ?? "",
    yearsOfCaregiving: cg?.years_of_caregiving ?? "",
    caregiverPurpose: str(pf.caregiverPurpose ?? det.purpose ?? ""),
    caregiverPurposeOther: str(pf.caregiverPurposeOther ?? ""),
    supportingInfo: str(det.supportingInfo ?? ""),
  };
}

// Shared input card wrapper
function Card({
  title,
  subtitle,
  headerAside,
  children,
}: {
  title: string;
  subtitle?: string;
  headerAside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-navy sm:text-base">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-muted sm:text-xs">{subtitle}</p>}
        </div>
        {headerAside ? <div className="shrink-0">{headerAside}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function ApplicantEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [meta, setMeta] = useState<{
    ref: string;
    region: string;
    district: string;
    registrationType: string;
    photoPath: string | null;
    caregiverPhotoPath: string | null;
    createdAt: string;
  } | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [caregiverPhoto, setCaregiverPhoto] = useState<File | null>(null);
  const [beneficiaryPhoto, setBeneficiaryPhoto] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErrors((prev) => {
      if (!prev[k]) return prev;
      const next = { ...prev };
      delete next[k];
      return next;
    });
  }

  useEffect(() => {
    api<Lookups>("/api/auth/lookups").then(setLookups).catch(() => setLookups({ disabilities: [] }));
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api<ApplicantDetail>(`/api/applicants/${id}`)
      .then((a) => {
        const scheduleB = lookups?.disabilities ?? [];
        setForm(applicantToForm(a, scheduleB));
        setMeta({
          ref: a.applicant_ref,
          region: a.region_name,
          district: a.district_name,
          registrationType: a.registration_type,
          photoPath: a.photo_path,
          caregiverPhotoPath: a.caregiver_photo_path,
          createdAt: a.created_at,
        });
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, lookups?.disabilities]);

  const isCaregiverReg = meta?.registrationType === "caregiver";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    const err: Record<string, string> = {};
    if (isCaregiverReg) {
      if (!form.caregiverName.trim()) err.caregiverName = "Name of caregiver is required.";
      const cgCardErr = ghanaCardValidationError(form.caregiverGhanaCard, true);
      if (cgCardErr) err.caregiverGhanaCard = cgCardErr;
      const cgPhoneErr = phoneValidationError(form.caregiverPhone, true);
      if (cgPhoneErr) err.caregiverPhone = cgPhoneErr;
    }
    if (!form.fullName.trim()) err.fullName = "Name of beneficiary is required.";
    const beneficiaryPhoneErr = phoneValidationError(form.phone, true);
    if (beneficiaryPhoneErr) err.phone = beneficiaryPhoneErr;
    const beneficiaryCardErr = ghanaCardValidationError(form.ghanaCard, !isCaregiverReg);
    if (beneficiaryCardErr) err.ghanaCard = beneficiaryCardErr;
    const nhisErr = nhisValidationError(form.nhisNumber, false);
    if (nhisErr) err.nhisNumber = nhisErr;

    setFieldErrors(err);
    if (Object.keys(err).length > 0) {
      setError("Please correct the fields marked below.");
      const first = Object.keys(err)[0];
      document.getElementById(`edit-field-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError("");

    setSaving(true);
    setError("");
    try {
      const isOtherDis = form.disabilityCategory.startsWith("Other");
      await api(`/api/applicants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          communityName: form.communityName,
          fullName: form.fullName,
          ghanaCard: form.ghanaCard,
          nhisNumber: form.nhisNumber,
          phone: form.phone,
          sex: form.sex,
          age: form.age ? Number(form.age) : null,
          homeAddress: form.homeAddress,
          disabilityCategory: form.disabilityCategory,
          disabilityOther: isOtherDis ? form.disabilityOther.trim() || null : null,
          occupation: form.occupation,
          educationLevel: educationLevelForSubmit(form.educationLevel, form.educationLevelOther),
          residenceType: form.residenceType,
          residenceOther: form.residenceOther,
          caregiverName: form.caregiverName,
          caregiverAge: form.caregiverAge ? Number(form.caregiverAge) : null,
          caregiverSex: form.caregiverSex,
          caregiverEducationLevel: educationLevelForSubmit(form.caregiverEducationLevel, form.caregiverEducationLevelOther),
          caregiverHomeAddress: form.caregiverHomeAddress,
          caregiverCommunityName: form.caregiverCommunityName,
          caregiverPhone: form.caregiverPhone,
          caregiverGhanaCard: form.caregiverGhanaCard,
          caregiverResidenceType: form.caregiverResidenceType,
          caregiverResidenceOther: form.caregiverResidenceOther,
          caregiverRelationship: form.caregiverRelationship,
          caregiverRelationshipOther: form.caregiverRelationshipOther,
          hoursOfCaregiving: form.hoursOfCaregiving,
          yearsOfCaregiving: form.yearsOfCaregiving,
          caregiverPurpose: form.caregiverPurpose || null,
          caregiverPurposeOther: form.caregiverPurposeOther || null,
          supportingInfo: form.supportingInfo || null,
        }),
      });
      if (caregiverPhoto && isCaregiverReg) {
        await uploadApplicantPassportPhoto(id, caregiverPhoto, { forCaregiver: true });
      }
      if (beneficiaryPhoto && !isCaregiverReg) {
        await uploadApplicantPassportPhoto(id, beneficiaryPhoto, { forCaregiver: false });
      }
      navigate(`/applicants?view=${encodeURIComponent(id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !form.fullName && !form.caregiverName) {
    return <p className="text-sm text-muted">Loading record…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageTitle
        title="Edit Registration Record"
        subtitle={
          meta
            ? `${meta.ref} · ${meta.region} / ${meta.district} · Registration particulars only (support requests are edited on Apply).`
            : "Registration particulars only."
        }
      >
        <Link to={`/applicants?view=${id}`} className="text-sm text-teal hover:underline">
          ← Back to view
        </Link>
      </PageTitle>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
      )}

      <form onSubmit={onSubmit} className="registration-form-mobile space-y-6">

        {/* ── Registration & Location ── */}
        <Card title="Registration &amp; Location">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Region">
              <input className={inputClass} value={meta?.region ?? ""} readOnly disabled />
            </Field>
            <Field label="District">
              <input className={inputClass} value={meta?.district ?? ""} readOnly disabled />
            </Field>
          </div>
        </Card>

        {/* ── Caregiver Particulars ── */}
        {isCaregiverReg && id && meta && (
          <Card
            title="Caregiver Particulars"
            headerAside={
              <PassportPhotoField
                applicantProfileId={id}
                photoSubject="caregiver"
                photoPath={meta.caregiverPhotoPath}
                file={caregiverPhoto}
                onChange={setCaregiverPhoto}
                label="Photo"
                size="compact"
                boxAlign="end"
              />
            }
          >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 text-sm text-navy">
              <span className="font-medium">Registration date</span>
              <span className="text-muted"> · </span>
              <span>{formatAppDateFromIso(meta?.createdAt) || "—"}</span>
            </div>
            <Field label="Full name">
              <input
                className={inputClass}
                value={form.caregiverName}
                onChange={(e) => set("caregiverName", e.target.value)}
                required
              />
            </Field>
              <Field label="Ghana Card (PIN)">
                <div id="edit-field-caregiverGhanaCard">
                  <GhanaCardInput
                    className={inputClass}
                    value={form.caregiverGhanaCard}
                    onChange={(v) => set("caregiverGhanaCard", v)}
                    required
                    error={fieldErrors.caregiverGhanaCard}
                  />
                </div>
              </Field>
              <Field label="Age">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={form.caregiverAge}
                  onChange={(e) => set("caregiverAge", e.target.value)}
                />
              </Field>
              <Field label="Phone / contact">
                <div id="edit-field-caregiverPhone">
                  <PhoneInput
                    className={inputClass}
                    value={form.caregiverPhone}
                    onChange={(v) => set("caregiverPhone", v)}
                    required
                    error={fieldErrors.caregiverPhone}
                  />
                </div>
              </Field>
              <RadioGroup
                label="Sex"
                name="caregiverSex"
                value={form.caregiverSex}
                options={[
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                ]}
                onChange={(v) => set("caregiverSex", v)}
              />
              <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                <RadioGroup
                  label="Type of residence"
                  name="caregiverResidenceType"
                  value={form.caregiverResidenceType}
                  options={RESIDENCE_OPTIONS}
                  onChange={(v) => set("caregiverResidenceType", v)}
                  otherValue={form.caregiverResidenceOther}
                  onOther={(v) => set("caregiverResidenceOther", v)}
                />
                <Field label="Level of education">
                  <EducationLevelSelect
                    className={inputClass}
                    value={form.caregiverEducationLevel}
                    otherValue={form.caregiverEducationLevelOther}
                    onChange={(v) => set("caregiverEducationLevel", v)}
                    onOtherChange={(v) => set("caregiverEducationLevelOther", v)}
                  />
                </Field>
              </div>
              <Field label="Town or community">
                <input
                  className={inputClass}
                  value={form.caregiverCommunityName}
                  onChange={(e) => set("caregiverCommunityName", e.target.value)}
                />
              </Field>
              <Field label="Home address">
                <input
                  className={inputClass}
                  value={form.caregiverHomeAddress}
                  onChange={(e) => set("caregiverHomeAddress", e.target.value)}
                />
              </Field>
              <RadioGroup
                label="Relationship to beneficiary"
                name="caregiverRelationship"
                value={form.caregiverRelationship}
                options={CAREGIVER_RELATIONSHIP_OPTIONS}
                onChange={(v) => set("caregiverRelationship", v)}
                otherValue={form.caregiverRelationshipOther}
                onOther={(v) => set("caregiverRelationshipOther", v)}
              />
              <RadioGroup
                label="Primary purpose of caregiver support"
                name="caregiverPurpose"
                value={form.caregiverPurpose}
                options={CAREGIVER_PURPOSE_OPTIONS}
                onChange={(v) => set("caregiverPurpose", v)}
                otherValue={form.caregiverPurposeOther}
                onOther={(v) => set("caregiverPurposeOther", v)}
              />
              <div className="md:col-span-2">
                <Field label="Additional supporting notes">
                  <textarea
                    className={inputClass}
                    rows={2}
                    value={form.supportingInfo}
                    onChange={(e) => set("supportingInfo", e.target.value)}
                    placeholder="Special notes or context regarding the care situation…"
                  />
                </Field>
              </div>
              <Field label="Hours of caregiving per day">
                <input
                  className={inputClass}
                  value={form.hoursOfCaregiving}
                  onChange={(e) => set("hoursOfCaregiving", e.target.value)}
                />
              </Field>
              <Field label="Years of caregiving">
                <input
                  className={inputClass}
                  value={form.yearsOfCaregiving}
                  onChange={(e) => set("yearsOfCaregiving", e.target.value)}
                />
              </Field>
            </div>
          </Card>
        )}

        {/* ── Applicant / Person Receiving Care ── */}
        <Card
          title={isCaregiverReg ? "Person Receiving Care" : "Applicant Particulars"}
          headerAside={
            !isCaregiverReg && id && meta ? (
              <PassportPhotoField
                applicantProfileId={id}
                photoSubject="beneficiary"
                photoPath={meta.photoPath}
                file={beneficiaryPhoto}
                onChange={setBeneficiaryPhoto}
                label="Photo"
                size="compact"
                boxAlign="end"
              />
            ) : undefined
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 text-sm text-navy">
              <span className="font-medium">Registration date</span>
              <span className="text-muted"> · </span>
              <span>{formatAppDateFromIso(meta?.createdAt) || "—"}</span>
            </div>
            <Field label={isCaregiverReg ? "Name of beneficiary (PWD)" : "Full name"}>
              <input
                className={inputClass}
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                required
              />
            </Field>
            {!isCaregiverReg && (
              <>
                <Field label="Ghana Card (PIN)">
                  <div id="edit-field-ghanaCard">
                    <GhanaCardInput
                      className={inputClass}
                      value={form.ghanaCard}
                      onChange={(v) => set("ghanaCard", v)}
                      error={fieldErrors.ghanaCard}
                    />
                  </div>
                </Field>
                <Field label="NHIS Card Number">
                  <div id="edit-field-nhisNumber">
                    <NhisInput
                      className={inputClass}
                      value={form.nhisNumber}
                      onChange={(v) => set("nhisNumber", v)}
                      error={fieldErrors.nhisNumber}
                    />
                  </div>
                </Field>
              </>
            )}
            {isCaregiverReg && (
              <>
                <Field label="Ghana Card (PIN)">
                  <div id="edit-field-ghanaCard">
                    <GhanaCardInput
                      className={inputClass}
                      value={form.ghanaCard}
                      onChange={(v) => set("ghanaCard", v)}
                      error={fieldErrors.ghanaCard}
                    />
                  </div>
                </Field>
                <Field label="NHIS Card Number">
                  <div id="edit-field-nhisNumber">
                    <NhisInput
                      className={inputClass}
                      value={form.nhisNumber}
                      onChange={(v) => set("nhisNumber", v)}
                      error={fieldErrors.nhisNumber}
                    />
                  </div>
                </Field>
              </>
            )}
            <Field label="Age">
              <input
                className={inputClass}
                type="number"
                min={0}
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
              />
            </Field>
            <Field label="Phone / contact">
              <div id="edit-field-phone">
                <PhoneInput
                  className={inputClass}
                  value={form.phone}
                  onChange={(v) => set("phone", v)}
                  required
                  error={fieldErrors.phone}
                />
              </div>
            </Field>
            <Field label="Town or community">
              <input
                className={inputClass}
                value={form.communityName}
                onChange={(e) => set("communityName", e.target.value)}
              />
            </Field>
            <Field label="Residential address / landmark">
              <input
                className={inputClass}
                value={form.homeAddress}
                onChange={(e) => set("homeAddress", e.target.value)}
              />
            </Field>
            <RadioGroup
              label="Type of residence"
              name="residenceType"
              value={form.residenceType}
              options={RESIDENCE_OPTIONS}
              onChange={(v) => set("residenceType", v)}
              otherValue={form.residenceOther}
              onOther={(v) => set("residenceOther", v)}
            />
            <RadioGroup
              label="Sex"
              name="sex"
              value={form.sex}
              options={[
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
              ]}
              onChange={(v) => set("sex", v)}
            />
          </div>
        </Card>

        <Card
          title="Disability classification &amp; background"
          subtitle="Schedule B disability and socio-economic background (same as registration)."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Category of disability (Schedule B)">
              <select
                className={inputClass}
                value={form.disabilityCategory}
                onChange={(e) => set("disabilityCategory", e.target.value)}
              >
                <option value="">Select disability category</option>
                {(lookups?.disabilities ?? []).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            {form.disabilityCategory.startsWith("Other") ? (
              <Field label="Specify disability category">
                <input
                  className={inputClass}
                  value={form.disabilityOther}
                  onChange={(e) => set("disabilityOther", e.target.value)}
                  placeholder="Describe the disability category"
                  required
                />
              </Field>
            ) : null}
            <Field label="Level of education">
              <EducationLevelSelect
                className={inputClass}
                value={form.educationLevel}
                otherValue={form.educationLevelOther}
                onChange={(v) => set("educationLevel", v)}
                onOtherChange={(v) => set("educationLevelOther", v)}
              />
            </Field>
            <Field label="Current occupation">
              <input
                className={inputClass}
                value={form.occupation}
                onChange={(e) => set("occupation", e.target.value)}
                placeholder="e.g. Petty trader, Unemployed, Student"
              />
            </Field>
          </div>
        </Card>

        {/* ── Action Bar ── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to={`/applicants?view=${id}`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal/90 transition disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
