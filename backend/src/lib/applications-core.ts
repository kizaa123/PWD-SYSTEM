import { all, db, get, now, run } from "../db/index.ts";
import { applicationReference, newId } from "./crypto.ts";
import type { AuthUser } from "./auth.ts";

export function currentApplicationYear(): number {
  return new Date().getFullYear();
}

/** Statuses shown as Complete — that year's request is finished. */
export const COMPLETED_YEAR_STATUSES = [
  "disbursement",
  "pending_fulfilment",
  "partially_fulfilled",
  "completed",
  "fulfilled",
] as const;

export function completedApplicationForYear(profileId: string, year: number) {
  const placeholders = COMPLETED_YEAR_STATUSES.map(() => "?").join(",");
  return get<{ id: string; reference: string }>(
    `SELECT id, reference FROM applications
     WHERE applicant_profile_id = ? AND application_year = ? AND status IN (${placeholders})
     LIMIT 1`,
    [profileId, year, ...COMPLETED_YEAR_STATUSES],
  );
}

/** SQL fragment: {year} request counts as submitted (includes post-registration apply with office-use decision). */
export function sqlSubstantiveYearApplication(alias = "", yearParam = "?"): string {
  const p = alias ? `${alias}.` : "";
  return `${p}application_year = ${yearParam}
    AND ${sqlApplicationIsSubstantive(alias || undefined)}`;
}

/** Whether an applications row counts as a real support request (excludes bare registration drafts). */
export function sqlApplicationIsSubstantive(alias?: string): string {
  const p = alias ? `${alias}.` : "";
  return `${p}status NOT IN ('cancelled', 'rejected')
    AND (${p}status != 'registration' OR ${p}office_use_qualified IN ('qualified', 'not_qualified'))`;
}

/** EXISTS / NOT EXISTS any substantive application year (all years). */
export function sqlProfileHasSubstantiveApplicationAnyYear(
  profileColumn = "ap.id",
  hasApplied: boolean,
): string {
  const exists = hasApplied ? "EXISTS" : "NOT EXISTS";
  return `${exists} (
    SELECT 1 FROM applications ax
    WHERE ax.applicant_profile_id = ${profileColumn}
      AND ${sqlApplicationIsSubstantive("ax")}
  )`;
}

/** Applicant has a substantive {year} request (past intake / registration-only drafts). */
export function applicantProfileIdsAppliedForYear(year: number): Set<string> {
  return new Set(
    all<{ applicant_profile_id: string }>(
      `SELECT DISTINCT applicant_profile_id FROM applications
       WHERE ${sqlSubstantiveYearApplication()}`,
      [year],
    ).map((r) => r.applicant_profile_id),
  );
}

export function substantiveApplicationForYear(profileId: string, year: number) {
  return get<{ id: string; reference: string }>(
    `SELECT id, reference FROM applications
     WHERE applicant_profile_id = ? AND ${sqlSubstantiveYearApplication()}
     LIMIT 1`,
    [profileId, year],
  );
}

/** SQL: profile has an active {year} application (not cancelled/rejected). */
export function sqlProfileHasActiveYearApplication(
  year: number,
  profileColumn = "ap.id",
  hasApplication: boolean,
): { sql: string; params: number[] } {
  const exists = hasApplication ? "EXISTS" : "NOT EXISTS";
  return {
    sql: `${exists} (
      SELECT 1 FROM applications ax
      WHERE ax.applicant_profile_id = ${profileColumn}
        AND ax.application_year = ?
        AND ax.status NOT IN ('cancelled', 'rejected')
    )`,
    params: [year],
  };
}

/** SQL: profile has completed intake / substantive {year} request (same rule as applied_current_year). */
export function sqlProfileHasAppliedForSupportYear(
  year: number,
  profileColumn = "ap.id",
  hasApplied: boolean,
): { sql: string; params: number[] } {
  const exists = hasApplied ? "EXISTS" : "NOT EXISTS";
  return {
    sql: `${exists} (
      SELECT 1 FROM applications ax
      WHERE ax.applicant_profile_id = ${profileColumn}
        AND ${sqlSubstantiveYearApplication("ax")}
    )`,
    params: [year],
  };
}

/** Registered person has opened a {year} support request (any active application row). */
export function applicantProfileIdsWithYearApplication(year: number): Set<string> {
  return new Set(
    all<{ applicant_profile_id: string }>(
      `SELECT DISTINCT applicant_profile_id FROM applications
       WHERE application_year = ?
         AND status NOT IN ('cancelled', 'rejected')`,
      [year],
    ).map((r) => r.applicant_profile_id),
  );
}

export type CurrentYearApplicationSummary = {
  id: string;
  reference: string;
  status: string;
  category_code: string;
  category_name: string;
  amount_requested_pesewas: number | null;
  created_at: string;
  application_year: number;
  office_use_qualified: string | null;
};

/** Latest active application per profile for a given year. */
export function currentYearApplicationsByProfile(year: number): Map<string, CurrentYearApplicationSummary> {
  type Row = CurrentYearApplicationSummary & { applicant_profile_id: string };
  const rows = all<Row>(
    `SELECT a.id, a.applicant_profile_id, a.reference, a.status, a.category_code, sc.name AS category_name,
            a.amount_requested_pesewas, a.created_at, a.application_year, a.office_use_qualified
     FROM applications a
     JOIN support_categories sc ON sc.code = a.category_code
     WHERE a.application_year = ?
       AND a.status NOT IN ('cancelled', 'rejected')
     ORDER BY a.updated_at DESC`,
    [year],
  );
  const map = new Map<string, CurrentYearApplicationSummary>();
  for (const row of rows) {
    if (map.has(row.applicant_profile_id)) continue;
    map.set(row.applicant_profile_id, {
      id: row.id,
      reference: row.reference,
      status: row.status,
      category_code: row.category_code,
      category_name: row.category_name,
      amount_requested_pesewas: row.amount_requested_pesewas,
      created_at: row.created_at,
      application_year: row.application_year,
      office_use_qualified: (row.office_use_qualified as string | null) ?? null,
    });
  }
  return map;
}

function str(v: unknown): string | null {
  if (v == null || v === "") return null;
  return String(v);
}

const CATEGORY_DETAIL_TABLE: Record<string, string> = {
  education: "education_details",
  health: "health_details",
  assistive_device: "health_details",
  income_generating: "income_activity_details",
  caregivers: "caregiver_support_details",
};

/** Drops the detail row of a category, e.g. when a request moves to another category. */
export function clearCategoryDetails(applicationId: string, category: string) {
  const table = CATEGORY_DETAIL_TABLE[category];
  if (table) run(`DELETE FROM ${table} WHERE application_id = ?`, [applicationId]);
}

export function saveCategoryDetails(applicationId: string, category: string, d: Record<string, unknown>) {
  if (category === "education") {
    run("DELETE FROM education_details WHERE application_id = ?", [applicationId]);
    run(
      `INSERT INTO education_details (application_id, education_mode, education_level, enrolment_status, apprenticeship_type, support_type, school_name, school_type, qualification_pursued, school_account_name, school_account_number, school_bank_name, school_branch, device_key, device_type, device_other)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        applicationId,
        str(d.educationMode),
        str(d.educationLevel),
        str(d.enrolmentStatus),
        str(d.apprenticeshipType),
        str(d.supportType),
        str(d.schoolName),
        str(d.schoolType),
        str(d.qualificationPursued),
        str(d.schoolAccountName),
        str(d.schoolAccountNumber),
        str(d.schoolBankName),
        str(d.schoolBranch),
        str(d.assistiveDeviceKey),
        str(d.assistiveDeviceType),
        str(d.deviceOther),
      ],
    );
  } else if (category === "health" || category === "assistive_device") {
    run("DELETE FROM health_details WHERE application_id = ?", [applicationId]);
    run(
      `INSERT INTO health_details (application_id, health_purpose, health_purpose_other, healthcare_provider, nhis_number, nhis_verification_status, assistive_device_type, assistive_device_key, already_receiving_assistive, existing_assistive_detail, prescribed_where)
       VALUES (?,?,?,?,?, 'declared',?,?,?,?,?)`,
      [
        applicationId,
        str(d.healthPurpose),
        str(d.healthPurposeOther),
        str(d.healthcareProvider),
        str(d.nhisNumber),
        str(d.assistiveDeviceType),
        str(d.assistiveDeviceKey),
        d.alreadyReceivingAssistive ? 1 : 0,
        str(d.existingAssistiveDetail),
        str(d.prescribedWhere),
      ],
    );
  } else if (category === "income_generating") {
    run("DELETE FROM income_activity_details WHERE application_id = ?", [applicationId]);
    const rawSubtype = String(d.subtype || "startup_capital");
    const subtype = rawSubtype === "startup_tool" ? "startup_tool" : "startup_capital";
    run(
      `INSERT INTO income_activity_details (application_id, subtype, business_stage, business_activity, item_specification, device_key, device_type)
       VALUES (?,?,?,?,?,?,?)`,
      [
        applicationId,
        subtype,
        str(d.businessStage),
        str(d.businessActivity),
        str(d.itemSpecification),
        subtype === "startup_tool" ? null : str(d.assistiveDeviceKey),
        subtype === "startup_tool" ? null : str(d.assistiveDeviceType),
      ],
    );
  } else if (category === "caregivers") {
    run("DELETE FROM caregiver_support_details WHERE application_id = ?", [applicationId]);
    run(
      `INSERT INTO caregiver_support_details (application_id, caregiver_person_id, caregiver_ghana_card, pwd_nhis_number, relationship, relationship_other, hours_of_caregiving, years_of_caregiving, caregiver_education_level, caregiver_residence_type, purpose, purpose_other)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        applicationId,
        str(d.caregiverPersonId),
        str(d.caregiverGhanaCard),
        str(d.pwdNhisNumber),
        str(d.relationship),
        str(d.relationshipOther),
        str(d.hoursOfCaregiving),
        str(d.yearsOfCaregiving),
        str(d.caregiverEducationLevel),
        str(d.caregiverResidenceType),
        str(d.purpose),
        str(d.purposeOther),
      ],
    );
  }
}

export function createYearlyApplication(opts: {
  profileId: string;
  category: string;
  actor: AuthUser;
  amountRequested?: number | null;
  purposeSummary?: string | null;
  applicantSignatureLabel?: string | null;
  endorsingOfficerName?: string | null;
  endorsedAt?: string | null;
  officeUseQualified?: string | null;
  officeUseRemarks?: string | null;
  details?: Record<string, unknown>;
  year?: number;
}) {
  const year = opts.year ?? currentApplicationYear();
  const profile = get<{ id: string; region_id: string; district_id: string; person_id: string }>(
    "SELECT id, region_id, district_id, person_id FROM applicant_profiles WHERE id = ?",
    [opts.profileId],
  );
  if (!profile) throw Object.assign(new Error("Applicant profile is required"), { status: 400 });

  const substantive = substantiveApplicationForYear(profile.id, year);
  if (substantive) {
    throw Object.assign(
      new Error(
        `This applicant already has a ${year} support request on file (${substantive.reference}). A new request can be opened next year.`,
      ),
      { status: 409, details: { applicationId: substantive.id, reference: substantive.reference } },
    );
  }

  const open = get<{ id: string; reference: string }>(
    `SELECT id, reference FROM applications
     WHERE applicant_profile_id = ? AND category_code = ? AND application_year = ?
       AND status NOT IN ('rejected','cancelled','completed')`,
    [profile.id, opts.category, year],
  );
  if (open) {
    throw Object.assign(
      new Error(`An open ${opts.category} request for ${year} already exists (${open.reference})`),
      { status: 409, details: { applicationId: open.id, reference: open.reference } },
    );
  }

  const cat = get("SELECT code FROM support_categories WHERE code = ? AND is_active = 1", [opts.category]);
  if (!cat) throw Object.assign(new Error("Unknown support category"), { status: 400 });

  const ts = now();
  const id = newId("app");
  const reference = applicationReference();
  const amount = opts.amountRequested != null ? Math.round(Number(opts.amountRequested) * 100) : null;

  db.exec("BEGIN");
  try {
    run(
      `INSERT INTO applications (id, reference, applicant_profile_id, category_code, region_id, district_id, status,
        application_year, amount_requested_pesewas, amount_approved_pesewas, currency, purpose_summary, applicant_signature_label,
        endorsing_officer_name, endorsed_at, office_use_qualified, office_use_remarks,
        submitted_at, created_by_user_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?, 'registration', ?, ?, NULL, 'GHS', ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        id,
        reference,
        profile.id,
        opts.category,
        profile.region_id,
        profile.district_id,
        year,
        amount,
        opts.purposeSummary ?? null,
        str(opts.applicantSignatureLabel),
        str(opts.endorsingOfficerName),
        opts.endorsedAt ?? ts,
        opts.officeUseQualified === "qualified" || opts.officeUseQualified === "not_qualified"
          ? opts.officeUseQualified
          : null,
        str(opts.officeUseRemarks),
        opts.actor.id,
        ts,
        ts,
      ],
    );
    saveCategoryDetails(id, opts.category, opts.details || {});
    run(
      "INSERT INTO application_events (id, application_id, from_status, to_status, actor_user_id, note, created_at) VALUES (?,?,?,?,?,?,?)",
      [newId("evt"), id, null, "registration", opts.actor.id, `Year ${year} request registered — ref ${reference}`, ts],
    );
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return { id, reference, applicationYear: year };
}
