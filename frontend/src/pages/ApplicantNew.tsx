import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApplicantViewModal } from "../components/ApplicantViewModal";
import { GhanaCardInput } from "../components/GhanaCardInput";
import { NhisInput } from "../components/NhisInput";
import { PhoneInput } from "../components/PhoneInput";
import { PassportPhotoField } from "../components/PassportPhotoField";
import { buildApplicantRegistrationBody } from "../lib/applicantRegistrationPayload";
import { apiReachable, browserOnline, isLikelyNetworkError } from "../lib/connection";
import { writeLookupsCache, readLookupsCache } from "../lib/lookupsCache";
import {
  enqueuePendingRegistration,
  fileToPhotoPayload,
  countPendingRegistrations,
} from "../lib/offlineDb";
import { notifyRegistrationQueueChanged } from "../lib/registrationSync";
import { api, uploadApplicantPassportPhoto } from "../lib/api";
import { EducationLevelSelect } from "../components/EducationLevelSelect";
import { educationLevelForSubmit } from "../lib/educationLevels";
import { FormFieldError, fieldErrorBorder } from "../components/FormFieldError";
import { ghanaCardValidationError } from "../lib/ghanaCardFormat";
import { nhisValidationError } from "../lib/nhisFormat";
import { phoneValidationError } from "../lib/ghanaPhoneFormat";
import { useAuth } from "../lib/auth";
import { formatAppDate } from "../lib/dateFormat";
import { RESIDENCE_OPTIONS, RESIDENCE_TYPE_PLACEHOLDER } from "../components/RegistrationFormUi";

type Lookups = {
  regions: { id: string; name: string }[];
  districts: { id: string; name: string; region_id: string }[];
  disabilities: string[];
};

type RegType = "pwd" | "caregiver";

const CAREGIVER_RELATIONSHIPS = [
  "Mother",
  "Father",
  "Other relative",
  "Friend",
  "Other",
];

const CAREGIVER_PURPOSES = [
  "Treatments of person receiving care",
  "Basic Needs",
  "Utility Bills",
  "House Rent",
  "Other",
];

const emptyForm = {
  // Beneficiary (Person with disability)
  fullName: "",
  ghanaCard: "",
  nhisNumber: "",
  phone: "",
  sex: "female",
  age: "",
  regionId: "",
  districtId: "",
  communityName: "",
  homeAddress: "",
  disabilityCategory: "",
  disabilityOther: "",
  occupation: "",
  educationLevel: "",
  educationLevelOther: "",
  residenceType: "",
  residenceOther: "",

  // Caregiver particulars
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

type RegFieldKey =
  | "fullName"
  | "ghanaCard"
  | "phone"
  | "caregiverName"
  | "caregiverGhanaCard"
  | "caregiverPhone"
  | "nhisNumber"
  | "passportPhoto"
  | "residenceType"
  | "caregiverResidenceType";

export function ApplicantNewPage() {
  const navigate = useNavigate();
  const { has } = useAuth();
  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [lookupsReady, setLookupsReady] = useState(false);
  const [regType, setRegType] = useState<RegType>("caregiver");
  const registrationDateLabel = useMemo(() => formatAppDate(new Date()), []);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...emptyForm });
  const [registeredApplicantId, setRegisteredApplicantId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegFieldKey, string>>>({});

  function clearFieldError(key: RegFieldKey) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    if (
      k === "fullName" ||
      k === "ghanaCard" ||
      k === "phone" ||
      k === "caregiverName" ||
      k === "caregiverGhanaCard" ||
      k === "caregiverPhone" ||
      k === "nhisNumber" ||
      k === "residenceType" ||
      k === "caregiverResidenceType"
    ) {
      clearFieldError(k as RegFieldKey);
    }
  }

  function scrollToRegField(key: RegFieldKey) {
    requestAnimationFrame(() => {
      document.getElementById(`reg-field-${key}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function validateRegistrationFields(): boolean {
    const err: Partial<Record<RegFieldKey, string>> = {};
    if (!form.fullName.trim()) {
      err.fullName = "Name of the person with disability (beneficiary) is required.";
    }
    const beneficiaryCardErr = ghanaCardValidationError(form.ghanaCard, regType === "pwd");
    if (beneficiaryCardErr) err.ghanaCard = beneficiaryCardErr;
    const beneficiaryPhoneErr = phoneValidationError(form.phone, true);
    if (beneficiaryPhoneErr) err.phone = beneficiaryPhoneErr;
    const nhisErr = nhisValidationError(form.nhisNumber, false);
    if (nhisErr) err.nhisNumber = nhisErr;
    if (!form.residenceType.trim()) {
      err.residenceType = "Select type of residence for the person with disability.";
    }
    if (regType === "caregiver") {
      if (!form.caregiverResidenceType.trim()) {
        err.caregiverResidenceType = "Select type of residence for the caregiver.";
      }
      if (!form.caregiverName.trim()) err.caregiverName = "Caregiver name is required.";
      const caregiverCardErr = ghanaCardValidationError(form.caregiverGhanaCard, true);
      if (caregiverCardErr) err.caregiverGhanaCard = caregiverCardErr;
      const caregiverPhoneErr = phoneValidationError(form.caregiverPhone, true);
      if (caregiverPhoneErr) err.caregiverPhone = caregiverPhoneErr;
      if (!passportPhoto) err.passportPhoto = "A passport photograph of the caregiver is required.";
    } else if (!passportPhoto) {
      err.passportPhoto = "A passport photograph of the applicant is required.";
    }

    setFieldErrors(err);
    const keys = Object.keys(err) as RegFieldKey[];
    if (keys.length > 0) {
      setError("Please correct the fields marked below.");
      scrollToRegField(keys[0]!);
      return false;
    }
    setError("");
    return true;
  }

  useEffect(() => {
    let cancelled = false;
    const cached = readLookupsCache();
    if (cached?.districts?.length) {
      setLookups({
        regions: cached.regions,
        districts: cached.districts,
        disabilities: cached.disabilities,
      });
      setLookupsReady(true);
    }
    (async () => {
      try {
        const data = await api<Lookups>("/api/auth/lookups");
        if (cancelled) return;
        writeLookupsCache(data);
        setLookups(data);
        setLookupsReady(true);
        const district = data.districts[0];
        const region = data.regions[0];
        if (district && region) {
          setForm((current) => ({
            ...current,
            districtId: current.districtId || district.id,
            regionId: current.regionId || region.id,
          }));
        }
      } catch {
        const cached = readLookupsCache();
        if (cached && !cancelled) {
          setLookups({ regions: cached.regions, districts: cached.districts, disabilities: cached.disabilities });
          setLookupsReady(true);
          const district = cached.districts[0];
          const region = cached.regions[0];
          if (district && region) {
            setForm((current) => ({
              ...current,
              districtId: current.districtId || district.id,
              regionId: current.regionId || region.id,
            }));
          }
        } else if (!cancelled) {
          setLookupsReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!has("applicants.create")) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Only authorised social welfare staff are permitted to register applicants.
      </div>
    );
  }

  if (lookupsReady && !lookups) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-navy">
        <p className="font-semibold">Form not cached yet</p>
        <p className="mt-2 text-muted">Open the app once while online, then you can register offline on this device.</p>
      </div>
    );
  }

  if (!lookupsReady || !lookups) {
    return <p className="text-sm text-muted">Loading registration form…</p>;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setInfo("");
    if (!validateRegistrationFields()) return;

    setBusy(true);
    const clientRegistrationId = crypto.randomUUID();
    const payload = buildApplicantRegistrationBody(form, regType, clientRegistrationId);

    async function saveOffline() {
      const photo = passportPhoto ? await fileToPhotoPayload(passportPhoto) : undefined;
      await enqueuePendingRegistration({
        id: clientRegistrationId,
        createdAt: new Date().toISOString(),
        status: "pending",
        registrationType: regType,
        body: payload,
        photo,
        photoForCaregiver: regType === "caregiver",
        beneficiaryLabel: form.fullName.trim() || "Applicant",
      });
      const n = await countPendingRegistrations();
      notifyRegistrationQueueChanged();
      setError("");
      setInfo(
        n > 1
          ? `Saved on this device (${n} waiting to sync).`
          : "Saved on this device. Will sync when online.",
      );
      setForm({ ...emptyForm });
      setPassportPhoto(null);
    }

    try {
      const reachable = browserOnline() && (await apiReachable());
      if (!reachable) {
        await saveOffline();
        return;
      }

      const result = await api<{
        id: string;
        application?: { id: string; reference: string; applicationYear: number };
      }>("/api/applicants", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (passportPhoto) {
        try {
          await uploadApplicantPassportPhoto(result.id, passportPhoto, {
            forCaregiver: regType === "caregiver",
          });
        } catch (photoErr) {
          setError(
            `Registration saved, but passport photo could not be uploaded: ${(photoErr as Error).message}. You can add the photo from Edit on the next screen.`
          );
          setRegisteredApplicantId(result.id);
          return;
        }
      }

      setRegisteredApplicantId(result.id);
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        try {
          await saveOffline();
          return;
        } catch (queueErr) {
          setError((queueErr as Error).message);
          return;
        }
      }
      const body = (err as Error & { details?: Record<string, unknown> }).details;
      if (body?.existing && typeof body.applicantId === "string") {
        setError(
          `This Ghana Card is already on file (${String(
            body.applicantRef || "registered"
          )}). Open the applicant record to start a new yearly request instead of registering again.`
        );
        setInfo(body.applicantId);
        return;
      }
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const selectedDistrict = lookups?.districts.find((d) => d.id === form.districtId);
  const selectedRegion = lookups?.regions.find((r) => r.id === form.regionId);

  return (
    <form onSubmit={onSubmit} className="registration-form-mobile mx-auto max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link
          to="/applicants"
          className="inline-flex items-center text-sm font-medium text-teal hover:underline mb-2"
        >
          ← Back to Applicants
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy">New Applicant Registration</h1>
            <p className="mt-1 text-sm text-muted">
              Register an applicant in the permanent municipal disability database.
            </p>
          </div>
          {selectedDistrict && (
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-muted">
              {selectedDistrict.name} {selectedRegion ? `· ${selectedRegion.name}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 space-y-2">
          <p className="font-medium">{error}</p>
          {info && !info.includes(" ") && (
            <Link
              to={`/applicants?view=${info}`}
              className="inline-block text-xs font-semibold text-red-800 underline hover:text-red-950"
            >
              Open existing applicant profile →
            </Link>
          )}
        </div>
      )}

      {/* 1. Registration Type */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <label className="block text-sm font-semibold text-navy mb-3">
          Registration Pathway <span className="text-red-500">*</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition ${
              regType === "caregiver"
                ? "border-teal bg-teal/5 text-navy"
                : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
            }`}
          >
            <input
              type="radio"
              name="regType"
              value="caregiver"
              checked={regType === "caregiver"}
              onChange={() => {
                setRegType("caregiver");
                setPassportPhoto(null);
              }}
              className="mt-1 h-4 w-4 accent-teal"
            />
            <div>
              <div className="text-sm font-semibold text-navy">Caregiver Registration</div>
              <div className="mt-0.5 text-xs text-muted">
                Primary caregiver or guardian registering on behalf of a dependent person with disability.
              </div>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-4 transition ${
              regType === "pwd"
                ? "border-teal bg-teal/5 text-navy"
                : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
            }`}
          >
            <input
              type="radio"
              name="regType"
              value="pwd"
              checked={regType === "pwd"}
              onChange={() => {
                setRegType("pwd");
                setPassportPhoto(null);
              }}
              className="mt-1 h-4 w-4 accent-teal"
            />
            <div>
              <div className="text-sm font-semibold text-navy">Person with Disability (PWD)</div>
              <div className="mt-0.5 text-xs text-muted">
                Direct registration for the individual receiving support.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 2. Caregiver Information (only in Caregiver mode) */}
      {regType === "caregiver" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-5 sm:p-6">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-navy sm:text-base">Caregiver Particulars</h2>
              <p className="mt-0.5 text-[11px] text-muted sm:text-xs">
                Identity, relationship, and contact information for the primary caregiver.
              </p>
            </div>
            <div id="reg-field-passportPhoto" className="shrink-0">
              <PassportPhotoField
                file={passportPhoto}
                onChange={(f) => {
                  setPassportPhoto(f);
                  clearFieldError("passportPhoto");
                }}
                required
                size="compact"
                boxAlign="end"
                label="Photo"
              />
              <FormFieldError message={fieldErrors.passportPhoto} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 text-sm text-navy">
                <span className="font-medium">Registration date</span>
                <span className="text-muted"> · </span>
                <span>{registrationDateLabel}</span>
              </div>
              <div className="sm:col-span-2" id="reg-field-caregiverName">
                <label className="block text-sm font-medium text-navy mb-1">
                  Full Name of Caregiver <span className="text-red-500">*</span>
                </label>
                <input
                  className={fieldErrorBorder(
                    Boolean(fieldErrors.caregiverName),
                    "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal",
                  )}
                  value={form.caregiverName}
                  onChange={(e) => set("caregiverName", e.target.value)}
                  placeholder="Enter full legal name"
                  required
                />
                <FormFieldError message={fieldErrors.caregiverName} />
              </div>

              <div id="reg-field-caregiverGhanaCard">
                <label className="block text-sm font-medium text-navy mb-1">
                  Caregiver Ghana Card (PIN) <span className="text-red-500">*</span>
                </label>
                <GhanaCardInput
                  value={form.caregiverGhanaCard}
                  onChange={(v) => set("caregiverGhanaCard", v)}
                  required
                  error={fieldErrors.caregiverGhanaCard}
                />
              </div>

              <div id="reg-field-caregiverPhone">
                <label className="block text-sm font-medium text-navy mb-1">
                  Contact Phone <span className="text-red-500">*</span>
                </label>
                <PhoneInput
                  id="caregiverPhone"
                  value={form.caregiverPhone}
                  onChange={(v) => set("caregiverPhone", v)}
                  required
                  error={fieldErrors.caregiverPhone}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1">Age</label>
                <input
                  type="number"
                  min={15}
                  max={120}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal"
                  value={form.caregiverAge}
                  onChange={(e) => set("caregiverAge", e.target.value)}
                  placeholder="Years"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1">Sex</label>
                <div className="flex gap-4 pt-2">
                  <label className="inline-flex items-center gap-2 text-sm text-navy cursor-pointer">
                    <input
                      type="radio"
                      name="caregiverSex"
                      checked={form.caregiverSex === "female"}
                      onChange={() => set("caregiverSex", "female")}
                      className="h-4 w-4 accent-teal"
                    />
                    Female
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm text-navy cursor-pointer">
                    <input
                      type="radio"
                      name="caregiverSex"
                      checked={form.caregiverSex === "male"}
                      onChange={() => set("caregiverSex", "male")}
                      className="h-4 w-4 accent-teal"
                    />
                    Male
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-navy">Town or community</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal"
                    value={form.caregiverCommunityName}
                    onChange={(e) => set("caregiverCommunityName", e.target.value)}
                    placeholder="e.g. Odokor"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-navy">Home address</label>
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal"
                    value={form.caregiverHomeAddress}
                    onChange={(e) => set("caregiverHomeAddress", e.target.value)}
                    placeholder="House number, landmark, or street"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-navy">Type of Residence</label>
                  <div id="reg-field-caregiverResidenceType">
                    <select
                      className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-teal focus:ring-1 focus:ring-teal ${
                        fieldErrors.caregiverResidenceType ? "border-red-400" : "border-slate-300"
                      }`}
                      value={form.caregiverResidenceType}
                      onChange={(e) => set("caregiverResidenceType", e.target.value)}
                    >
                      <option value="">{RESIDENCE_TYPE_PLACEHOLDER}</option>
                      {RESIDENCE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    {fieldErrors.caregiverResidenceType ? (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.caregiverResidenceType}</p>
                    ) : null}
                  </div>
                  {form.caregiverResidenceType === "Other" && (
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-navy outline-none focus:border-teal"
                      placeholder="Specify residence type"
                      value={form.caregiverResidenceOther}
                      onChange={(e) => set("caregiverResidenceOther", e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-navy">Level of education</label>
                  <EducationLevelSelect
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                    value={form.caregiverEducationLevel}
                    otherValue={form.caregiverEducationLevelOther}
                    onChange={(v) => set("caregiverEducationLevel", v)}
                    onOtherChange={(v) => set("caregiverEducationLevelOther", v)}
                  />
                </div>
              </div>

              <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-navy">Relationship to Beneficiary</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                    value={form.caregiverRelationship}
                    onChange={(e) => set("caregiverRelationship", e.target.value)}
                  >
                    <option value="">Select relationship</option>
                    {CAREGIVER_RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                  {form.caregiverRelationship === "Other" && (
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-navy outline-none focus:border-teal"
                      placeholder="Specify relationship"
                      value={form.caregiverRelationshipOther}
                      onChange={(e) => set("caregiverRelationshipOther", e.target.value)}
                    />
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-navy">Primary Purpose of Caregiver Support</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-teal focus:ring-1 focus:ring-teal"
                    value={form.caregiverPurpose}
                    onChange={(e) => set("caregiverPurpose", e.target.value)}
                  >
                    <option value="">Select purpose</option>
                    {CAREGIVER_PURPOSES.map((purp) => (
                      <option key={purp} value={purp}>
                        {purp}
                      </option>
                    ))}
                  </select>
                  {form.caregiverPurpose === "Other" && (
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-navy outline-none focus:border-teal"
                      placeholder="Specify purpose"
                      value={form.caregiverPurposeOther}
                      onChange={(e) => set("caregiverPurposeOther", e.target.value)}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1">Daily Caregiving Hours</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal"
                  value={form.hoursOfCaregiving}
                  onChange={(e) => set("hoursOfCaregiving", e.target.value)}
                  placeholder="e.g. 6 hours / day, Full time"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-navy mb-1">Years of Caregiving</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal"
                  value={form.yearsOfCaregiving}
                  onChange={(e) => set("yearsOfCaregiving", e.target.value)}
                  placeholder="e.g. 4 years"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-navy mb-1">Additional Supporting Notes</label>
                <textarea
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal"
                  value={form.supportingInfo}
                  onChange={(e) => set("supportingInfo", e.target.value)}
                  placeholder="Special notes or context regarding the care situation..."
                />
              </div>
            </div>
        </div>
      )}

      {/* 3. Beneficiary / Person with Disability */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-navy sm:text-base">
              {regType === "caregiver" ? "Person Receiving Care (Beneficiary)" : "Applicant Particulars"}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted sm:text-xs">
              Personal biodata and location for the person with disability.
            </p>
          </div>
          {regType === "pwd" && (
            <div id="reg-field-passportPhoto" className="shrink-0">
              <PassportPhotoField
                file={passportPhoto}
                onChange={(f) => {
                  setPassportPhoto(f);
                  clearFieldError("passportPhoto");
                }}
                required
                size="compact"
                boxAlign="end"
                label="Photo"
              />
              <FormFieldError message={fieldErrors.passportPhoto} />
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
            {regType === "pwd" ? (
              <div className="sm:col-span-2 text-sm text-navy">
                <span className="font-medium">Registration date</span>
                <span className="text-muted"> · </span>
                <span>{registrationDateLabel}</span>
              </div>
            ) : null}
            <div className="sm:col-span-2" id="reg-field-fullName">
              <label className="block text-sm font-medium text-navy mb-1">
                Full Legal Name <span className="text-red-500">*</span>
              </label>
              <input
                className={fieldErrorBorder(
                  Boolean(fieldErrors.fullName),
                  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal",
                )}
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="Enter full legal name"
                required
              />
              <FormFieldError message={fieldErrors.fullName} />
            </div>

            <div id="reg-field-ghanaCard">
              <label className="block text-sm font-medium text-navy mb-1">
                Ghana Card Number (PIN){" "}
                {regType === "caregiver" ? (
                  <span className="text-xs font-normal text-muted">(Optional)</span>
                ) : (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <GhanaCardInput
                value={form.ghanaCard}
                onChange={(v) => set("ghanaCard", v)}
                required={regType === "pwd"}
                error={fieldErrors.ghanaCard}
              />
            </div>

            <div id="reg-field-nhisNumber">
              <label className="block text-sm font-medium text-navy mb-1">
                NHIS Number <span className="text-xs text-muted font-normal">(Optional)</span>
              </label>
              <NhisInput value={form.nhisNumber} onChange={(v) => set("nhisNumber", v)} error={fieldErrors.nhisNumber} />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-1">Age</label>
              <input
                type="number"
                min={0}
                max={120}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal"
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
                placeholder="Years"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-1">Sex</label>
              <div className="flex gap-4 pt-2">
                <label className="inline-flex items-center gap-2 text-sm text-navy cursor-pointer">
                  <input
                    type="radio"
                    name="sex"
                    checked={form.sex === "female"}
                    onChange={() => set("sex", "female")}
                    className="h-4 w-4 accent-teal"
                  />
                  Female
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-navy cursor-pointer">
                  <input
                    type="radio"
                    name="sex"
                    checked={form.sex === "male"}
                    onChange={() => set("sex", "male")}
                    className="h-4 w-4 accent-teal"
                  />
                  Male
                </label>
              </div>
            </div>

            <div id="reg-field-phone">
              <label className="block text-sm font-medium text-navy mb-1">
                Primary Phone Number <span className="text-red-500">*</span>
              </label>
              <PhoneInput
                id="beneficiaryPhone"
                value={form.phone}
                onChange={(v) => set("phone", v)}
                required
                error={fieldErrors.phone}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-navy mb-1">Town or Community</label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal"
                value={form.communityName}
                onChange={(e) => set("communityName", e.target.value)}
                placeholder="e.g. Elmina Central, Bronyibima"
              />
            </div>

            <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-navy">Residential Address / Landmark</label>
                <input
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal"
                  value={form.homeAddress}
                  onChange={(e) => set("homeAddress", e.target.value)}
                  placeholder="House number, landmark, or description"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-navy">Type of Residence</label>
                <div id="reg-field-residenceType">
                  <select
                    className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-teal focus:ring-1 focus:ring-teal ${
                      fieldErrors.residenceType ? "border-red-400" : "border-slate-300"
                    }`}
                    value={form.residenceType}
                    onChange={(e) => set("residenceType", e.target.value)}
                  >
                    <option value="">{RESIDENCE_TYPE_PLACEHOLDER}</option>
                    {RESIDENCE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.residenceType ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.residenceType}</p>
                  ) : null}
                </div>
                {form.residenceType === "Other" && (
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-navy outline-none focus:border-teal"
                    placeholder="Specify residence type"
                    value={form.residenceOther}
                    onChange={(e) => set("residenceOther", e.target.value)}
                  />
                )}
              </div>
            </div>
        </div>
      </div>

      {/* 4. Disability & Socio-Economic Assessment */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-5 sm:p-6">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-semibold text-navy sm:text-base">Disability Classification & Background</h2>
          <p className="mt-0.5 text-xs text-muted">
            National Disability Council classification and current socio-economic status.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-navy mb-1">
              Category of Disability (Schedule B) <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-teal focus:ring-1 focus:ring-teal"
              value={form.disabilityCategory}
              onChange={(e) => set("disabilityCategory", e.target.value)}
              required
            >
              <option value="">Select disability category</option>
              {lookups?.disabilities.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {form.disabilityCategory.startsWith("Other") ? (
            <div>
              <label className="block text-sm font-medium text-navy mb-1">
                Specify disability category <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal"
                value={form.disabilityOther}
                onChange={(e) => set("disabilityOther", e.target.value)}
                placeholder="Describe the disability category"
                required
              />
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-navy mb-1">Level of education</label>
            <EducationLevelSelect
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none focus:border-teal focus:ring-1 focus:ring-teal"
              value={form.educationLevel}
              otherValue={form.educationLevelOther}
              onChange={(v) => set("educationLevel", v)}
              onOtherChange={(v) => set("educationLevelOther", v)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-1">Current Occupation</label>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal"
              value={form.occupation}
              onChange={(e) => set("occupation", e.target.value)}
              placeholder="e.g. Petty trader, Artisan, Unemployed, Student"
            />
          </div>
        </div>
      </div>


      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          to="/applicants"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={busy || !form.districtId}
          className="rounded-lg bg-teal px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal/90 transition disabled:opacity-50"
        >
          {busy ? "Saving Registration…" : "Register Applicant"}
        </button>
      </div>

      {registeredApplicantId && (
        <ApplicantViewModal
          applicantId={registeredApplicantId}
          proceedFlow
          onClose={() => {
            setRegisteredApplicantId(null);
            navigate("/applicants");
          }}
          onProceedApplication={() => {
            const id = registeredApplicantId;
            setRegisteredApplicantId(null);
            navigate(`/apply?applicantId=${encodeURIComponent(id)}`);
          }}
        />
      )}
    </form>
  );
}
