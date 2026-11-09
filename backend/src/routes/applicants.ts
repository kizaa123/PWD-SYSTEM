import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { all, db, get, now, run } from "../db/index.ts";
import { COVERAGE_DISTRICT_CODE } from "../db/policy.ts";
import { listAssistiveDeviceHistory } from "../lib/assistive-device-policy.ts";
import { listStartupToolHistory } from "../lib/startup-tool-policy.ts";
import {
  applicantProfileIdsAppliedForYear,
  createYearlyApplication,
  currentApplicationYear,
  currentYearApplicationsByProfile,
  sqlProfileHasAppliedForSupportYear,
} from "../lib/applications-core.ts";
import { audit } from "../lib/audit.ts";
import { canAccessGeo, geoFilterSql, requireAuth, requirePermission } from "../lib/auth.ts";
import { applicantReference, maskIdentifier, newId, normalizeIdentifier } from "../lib/crypto.ts";
import {
  applicantListSqlExtra,
  canAccessApplicantRegister,
  visibleApplicationStatuses,
} from "../lib/workflow-access.ts";
import { buildRegistrationSupportIntake } from "../lib/registration-intake.ts";
import { resolveGhanaPhone } from "../lib/ghana-phone.ts";
import { resolveNhis } from "../lib/nhis.ts";
import { uploadsDir } from "../lib/paths.ts";
import { findDuplicates } from "../lib/workflow.ts";

export const applicantRouter = Router();
applicantRouter.use(requireAuth);

const uploadRoot = uploadsDir();
fs.mkdirSync(uploadRoot, { recursive: true });

const passportUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `passport-${newId("pic").slice(4)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Passport photo must be an image file"));
      return;
    }
    cb(null, true);
  },
});

const SUPPORT_MAP: Record<string, string> = {
  education: "education",
  health: "health",
  economic_empowerment: "income_generating",
  income_generating: "income_generating",
  assistive_device: "assistive_device",
  caregivers: "caregivers",
  other: "income_generating",
};

applicantRouter.get("/", requirePermission("applicants.read", "applications.read", "profile.self.read"), (req, res) => {
  const user = req.auth!;
  const q = String(req.query.q || "").trim();
  const appliedFilter = String(req.query.appliedFilter || "all").toLowerCase();
  let sql = `SELECT ap.*, p.full_name, p.sex, p.age, p.phone, p.email, ap.community_name,
                    d.name AS district_name, r.name AS region_name,
                    rp.full_name AS registered_by_name,
                    cg_p.full_name AS caregiver_full_name,
                    cg_p.phone AS caregiver_phone,
                    cg_cr.community_name AS caregiver_community_name,
                    (SELECT pi.value_normalized FROM person_identifiers pi
                     WHERE pi.person_id = cg_p.id AND pi.id_type = 'ghana_card' LIMIT 1) AS caregiver_ghana_card
             FROM applicant_profiles ap
             JOIN persons p ON p.id = ap.person_id
             JOIN regions r ON r.id = ap.region_id
             JOIN districts d ON d.id = ap.district_id
             LEFT JOIN users ru ON ru.id = ap.registered_by_user_id
             LEFT JOIN persons rp ON rp.id = ru.person_id
             LEFT JOIN caregiver_relationships cg_cr ON cg_cr.applicant_profile_id = ap.id AND cg_cr.status = 'active'
             LEFT JOIN persons cg_p ON cg_p.id = cg_cr.caregiver_person_id`;
  const params: (string | number)[] = [];
  const where: string[] = [];
  if (user.roles.includes("applicant") || user.roles.includes("caregiver")) {
    where.push("ap.person_id = ?");
    params.push(user.person_id || "");
  } else {
    const geo = geoFilterSql(user, "ap.region_id", "ap.district_id");
    where.push(geo.sql);
    params.push(...geo.params);
  }
  if (q) {
    where.push(
      "(p.full_name LIKE ? OR ap.applicant_ref LIKE ? OR p.phone LIKE ? OR rp.full_name LIKE ? OR cg_p.full_name LIKE ? OR cg_p.phone LIKE ?)",
    );
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const applicantPhase = applicantListSqlExtra(user);
  if (applicantPhase) {
    where.push(applicantPhase.sql);
    params.push(...applicantPhase.params);
  }
  const year = currentApplicationYear();
  if (appliedFilter === "not_applied") {
    const clause = sqlProfileHasAppliedForSupportYear(year, "ap.id", false);
    where.push(clause.sql);
    params.push(...clause.params);
  } else if (appliedFilter === "applied") {
    const clause = sqlProfileHasAppliedForSupportYear(year, "ap.id", true);
    where.push(clause.sql);
    params.push(...clause.params);
  }
  sql += ` WHERE ${where.join(" AND ")} ORDER BY ap.created_at DESC LIMIT 200`;
  const appliedThisYear = applicantProfileIdsAppliedForYear(year);
  const yearAppsByProfile = currentYearApplicationsByProfile(year);
  const rows = all<Record<string, unknown>>(sql, params).map((row) => {
    const profileId = row.id as string;
    const ids = all<{ id_type: string; value_normalized: string }>(
      "SELECT id_type, value_normalized FROM person_identifiers WHERE person_id = ?",
      [row.person_id as string],
    );
    const yearApp = yearAppsByProfile.get(profileId);
    const caregiverGhana = row.caregiver_ghana_card as string | undefined;
    return {
      ...row,
      ghana_card_masked: maskIdentifier(ids.find((i) => i.id_type === "ghana_card")?.value_normalized),
      caregiver_ghana_card_masked: maskIdentifier(caregiverGhana),
      nhis_masked: maskIdentifier(ids.find((i) => i.id_type === "nhis")?.value_normalized),
      applied_current_year: appliedThisYear.has(profileId),
      has_year_application: yearApp != null,
      application_year: year,
      current_year_application: yearApp ?? null,
    };
  });
  res.json(rows);
});

function caregiverPersonIdForProfile(profileId: string): string | null {
  const row = get<{ caregiver_person_id: string }>(
    "SELECT caregiver_person_id FROM caregiver_relationships WHERE applicant_profile_id = ? AND status = 'active' LIMIT 1",
    [profileId],
  );
  return row?.caregiver_person_id || null;
}

function caregiverExtrasFromRegistration(
  profileId: string,
  intake: { applicationDetails?: Record<string, unknown> } | null,
): {
  education_level: string | null;
  residence_type: string | null;
  residence_other: string | null;
} {
  const details = intake?.applicationDetails;
  if (details && typeof details === "object") {
    const education = details.caregiverEducationLevel != null ? String(details.caregiverEducationLevel) : null;
    const residenceType = details.caregiverResidenceType != null ? String(details.caregiverResidenceType) : null;
    const residenceOther =
      details.caregiverResidenceOther != null ? String(details.caregiverResidenceOther) : null;
    if (education || residenceType || residenceOther) {
      return {
        education_level: education || null,
        residence_type: residenceType || null,
        residence_other: residenceOther || null,
      };
    }
  }
  const row = get<{ caregiver_education_level: string | null; caregiver_residence_type: string | null }>(
    `SELECT csd.caregiver_education_level, csd.caregiver_residence_type
     FROM caregiver_support_details csd
     JOIN applications a ON a.id = csd.application_id
     WHERE a.applicant_profile_id = ?
     ORDER BY a.created_at DESC
     LIMIT 1`,
    [profileId],
  );
  return {
    education_level: row?.caregiver_education_level ?? null,
    residence_type: row?.caregiver_residence_type ?? null,
    residence_other: null,
  };
}

function passportPhotoPersonId(profile: { id: string; person_id: string; registration_type: string }, forCaregiver: boolean) {
  const useCaregiver =
    forCaregiver || profile.registration_type === "caregiver";
  if (useCaregiver) {
    const caregiverId = caregiverPersonIdForProfile(profile.id);
    if (!caregiverId) return null;
    return caregiverId;
  }
  return profile.person_id;
}

applicantRouter.post(
  "/:id/passport-photo",
  requirePermission("applicants.create", "applicants.update"),
  passportUpload.single("file"),
  (req, res) => {
    const profile = get<{ id: string; person_id: string; region_id: string; district_id: string; registration_type: string }>(
      "SELECT id, person_id, region_id, district_id, registration_type FROM applicant_profiles WHERE id = ?",
      [req.params.id],
    );
    if (!profile) return res.status(404).json({ error: "Applicant not found" });
    if (!canAccessGeo(req.auth!, profile.region_id, profile.district_id)) {
      return res.status(403).json({ error: "Outside your geographic scope" });
    }
    if (!req.file) return res.status(400).json({ error: "Passport photo file is required" });

    const forCaregiver = req.body?.forCaregiver === "true" || req.body?.forCaregiver === true;
    const targetPersonId = passportPhotoPersonId(profile, forCaregiver);
    if (!targetPersonId) {
      return res.status(400).json({ error: "No caregiver is linked to this record yet" });
    }

    const previous = get<{ photo_path: string | null }>("SELECT photo_path FROM persons WHERE id = ?", [targetPersonId]);
    const ts = now();
    run("UPDATE persons SET photo_path = ?, updated_at = ? WHERE id = ?", [req.file.filename, ts, targetPersonId]);
    if (previous?.photo_path && previous.photo_path !== req.file.filename) {
      const oldPath = path.join(uploadRoot, previous.photo_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const openApp = get<{ id: string }>(
      `SELECT id FROM applications WHERE applicant_profile_id = ? AND status IN ('registration', 'draft', 'submitted', 'returned_for_correction')
       ORDER BY created_at DESC LIMIT 1`,
      [profile.id],
    );
    if (openApp) {
      const docId = newId("doc");
      run(
        `INSERT INTO documents (id, application_id, applicant_profile_id, document_type, original_name, stored_path, mime_type, size_bytes, is_medical, verification_status, uploaded_by_user_id, created_at)
         VALUES (?,?,?,?,?,?,?,?,0, 'pending', ?, ?)`,
        [
          docId,
          openApp.id,
          profile.id,
          "passport_photo",
          req.file.originalname,
          req.file.filename,
          req.file.mimetype,
          req.file.size,
          req.auth!.id,
          ts,
        ],
      );
    }

    audit({
      actorUserId: req.auth!.id,
      action: "applicant.passport_photo",
      entityType: "applicant_profile",
      entityId: profile.id,
    });
    res.status(201).json({ photoPath: req.file.filename });
  },
);

applicantRouter.get("/:id/passport-photo", requirePermission("applicants.read", "applications.read", "profile.self.read"), (req, res) => {
  const profile = get<{ id: string; person_id: string; region_id: string; district_id: string; registration_type: string }>(
    "SELECT id, person_id, region_id, district_id, registration_type FROM applicant_profiles WHERE id = ?",
    [req.params.id],
  );
  if (!profile) return res.status(404).json({ error: "Applicant not found" });
  const user = req.auth!;
  const own = user.person_id === profile.person_id;
  if (!own && !canAccessGeo(user, profile.region_id, profile.district_id)) {
    return res.status(403).json({ error: "Outside your geographic scope" });
  }
  const subject = String(req.query.subject || "");
  const forCaregiver = subject === "beneficiary" ? false : profile.registration_type === "caregiver" || subject === "caregiver";
  const targetPersonId = passportPhotoPersonId(profile, forCaregiver);
  if (!targetPersonId) return res.status(404).json({ error: "No passport photo on file" });
  const person = get<{ photo_path: string | null }>("SELECT photo_path FROM persons WHERE id = ?", [targetPersonId]);
  if (!person?.photo_path) return res.status(404).json({ error: "No passport photo on file" });
  const filePath = path.join(uploadRoot, person.photo_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Photo file missing" });
  res.sendFile(filePath);
});

applicantRouter.get("/:id", requirePermission("applicants.read", "applications.read", "profile.self.read"), (req, res) => {
  const row = get<Record<string, unknown>>(
    `SELECT ap.*, p.full_name, p.date_of_birth, p.sex, p.age, p.phone, p.email, p.home_address, p.photo_path,
            (SELECT p_c.photo_path FROM caregiver_relationships cr
             JOIN persons p_c ON p_c.id = cr.caregiver_person_id
             WHERE cr.applicant_profile_id = ap.id AND cr.status = 'active' LIMIT 1) AS caregiver_photo_path,
            r.name AS region_name, d.name AS district_name, rp.full_name AS registered_by_name
     FROM applicant_profiles ap
     JOIN persons p ON p.id = ap.person_id
     JOIN regions r ON r.id = ap.region_id
     JOIN districts d ON d.id = ap.district_id
     LEFT JOIN users ru ON ru.id = ap.registered_by_user_id
     LEFT JOIN persons rp ON rp.id = ru.person_id
     WHERE ap.id = ?`,
    [req.params.id],
  );
  if (!row) return res.status(404).json({ error: "Applicant not found" });
  const user = req.auth!;
  const own = user.person_id === row.person_id;
  if (!own && !canAccessGeo(user, row.region_id as string, row.district_id as string)) {
    return res.status(403).json({ error: "Outside your geographic scope" });
  }
  if (!own && !canAccessApplicantRegister(user)) {
    const visible = visibleApplicationStatuses(user);
    if (visible && visible.length > 0) {
      const placeholders = visible.map(() => "?").join(", ");
      const linked = get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM applications WHERE applicant_profile_id = ? AND status IN (${placeholders})`,
        [row.id as string, ...visible],
      );
      if (!linked?.c) {
        return res.status(403).json({ error: "This applicant has not reached your workflow phase" });
      }
    } else if (visible && visible.length === 0) {
      return res.status(403).json({ error: "You cannot view applicant records" });
    }
  }
  const identifiers = all<{ id_type: string; value_normalized: string; verification_status: string; nhis_linked_to_ghana_card: number | null }>(
    "SELECT id_type, value_normalized, verification_status, nhis_linked_to_ghana_card FROM person_identifiers WHERE person_id = ?",
    [row.person_id as string],
  );
  const caregivers = all(
    `SELECT cr.*, p.full_name, p.phone, p.sex, p.age, p.home_address, p.email
     FROM caregiver_relationships cr JOIN persons p ON p.id = cr.caregiver_person_id
     WHERE cr.applicant_profile_id = ?`,
    [row.id as string],
  );
  let applications = all(
    `SELECT a.id, a.reference, a.category_code, a.status, a.application_year, a.amount_requested_pesewas, a.amount_approved_pesewas, a.purpose_summary, a.created_at, a.office_use_qualified, sc.name AS category_name
     FROM applications a
     JOIN support_categories sc ON sc.code = a.category_code
     WHERE a.applicant_profile_id = ?
     ORDER BY a.application_year DESC, a.created_at DESC`,
    [row.id as string],
  );
  const visible = visibleApplicationStatuses(user);
  if (visible && !canAccessApplicantRegister(user)) {
    applications = applications.filter((a) => visible.includes((a as { status: string }).status));
  }
  const showFull = user.permissions.includes("applicants.read") || own;
  let registrationSupportIntake = null;
  if (row.registration_support_intake) {
    try {
      registrationSupportIntake = JSON.parse(row.registration_support_intake as string);
    } catch {
      registrationSupportIntake = null;
    }
  }
  const caregiverProfileExtras = caregiverExtrasFromRegistration(row.id as string, registrationSupportIntake);
  const caregiversWithProfile = caregivers.map((c) => {
    const caregiverPersonId = (c as { caregiver_person_id: string }).caregiver_person_id;
    const caregiverGhana = get<{ value_normalized: string }>(
      "SELECT value_normalized FROM person_identifiers WHERE person_id = ? AND id_type = 'ghana_card' LIMIT 1",
      [caregiverPersonId],
    );
    return {
      ...c,
      ...caregiverProfileExtras,
      caregiver_ghana_card: showFull
        ? caregiverGhana?.value_normalized ?? null
        : caregiverGhana?.value_normalized
          ? maskIdentifier(caregiverGhana.value_normalized)
          : null,
    };
  });
  const year = currentApplicationYear();
  const appliedThisYear = applicantProfileIdsAppliedForYear(year);
  const yearApp = currentYearApplicationsByProfile(year).get(row.id as string);
  res.json({
    ...row,
    registration_support_intake: undefined,
    registrationSupportIntake,
    identifiers: identifiers.map((i) => ({
      ...i,
      value_normalized: showFull ? i.value_normalized : maskIdentifier(i.value_normalized),
    })),
    caregivers: caregiversWithProfile,
    applications,
    assistive_device_history: listAssistiveDeviceHistory(row.id as string),
    startup_tool_history: listStartupToolHistory(row.id as string),
    applied_current_year: appliedThisYear.has(row.id as string),
    application_year: year,
    current_year_application: yearApp ?? null,
  });
});

applicantRouter.post("/", requirePermission("applicants.create"), (req, res) => {
  if (req.auth!.roles.includes("caregiver") && !req.auth!.roles.some((role) => role !== "caregiver" && role !== "applicant")) {
    return res.status(403).json({ error: "A caregiver or family member cannot register a person with disability" });
  }
  const b = req.body || {};
  const clientRegistrationId = String(b.clientRegistrationId || "").trim() || null;
  if (clientRegistrationId) {
    const synced = get<{ id: string; person_id: string; registration_type: string }>(
      "SELECT id, person_id, registration_type FROM applicant_profiles WHERE client_registration_id = ?",
      [clientRegistrationId],
    );
    if (synced) {
      return res.status(200).json({
        id: synced.id,
        personId: synced.person_id,
        registrationType: synced.registration_type,
        synced: true,
      });
    }
  }
  const registrationType = String(b.registrationType || "pwd") === "caregiver" ? "caregiver" : "pwd";
  const district = get<{ id: string; region_id: string; code: string; is_active: number }>(
    "SELECT id, region_id, code, is_active FROM districts WHERE id = ?",
    [b.districtId],
  );
  if (!district || district.code !== COVERAGE_DISTRICT_CODE || !district.is_active) {
    return res.status(400).json({ error: "Registration is not available for this municipal area" });
  }
  if (!canAccessGeo(req.auth!, district.region_id, district.id)) {
    return res.status(403).json({ error: "You cannot register applicants outside your assigned area" });
  }

  // Beneficiary (PWD) is always the applicant profile subject.
  const beneficiaryName = String(b.fullName || b.beneficiaryName || "").trim();
  const beneficiaryCard = String(b.ghanaCard || b.beneficiaryGhanaCard || "").trim();
  if (!beneficiaryName) {
    return res.status(400).json({ error: "Name of the person with disability (beneficiary) is required" });
  }
  // Beneficiary Ghana Card is optional at registration (caregiver proxy registrations may not have it yet).
  const beneficiaryPhone = resolveGhanaPhone(b.phone, "Beneficiary contact phone", true);
  if ("error" in beneficiaryPhone) return res.status(400).json({ error: beneficiaryPhone.error });

  let normalizedCaregiverPhone: string | null = null;
  if (registrationType === "caregiver") {
    if (!b.caregiverName) return res.status(400).json({ error: "Name of caregiver is required" });
    if (!b.caregiverGhanaCard) return res.status(400).json({ error: "Caregiver Ghana Card is required" });
    const caregiverPhone = resolveGhanaPhone(b.caregiverPhone, "Caregiver contact phone", true);
    if ("error" in caregiverPhone) return res.status(400).json({ error: caregiverPhone.error });
    normalizedCaregiverPhone = caregiverPhone.value;
    if (!b.caregiverPurpose) {
      return res.status(400).json({ error: "Purpose of application is required (Treatments, Basic Needs, Utility Bills, House Rent, or Other)" });
    }
    // Type of support is chosen on the application form, not at registration.
  }

  const cardNorm = beneficiaryCard ? normalizeIdentifier(beneficiaryCard) : null;
  if (cardNorm) {
    const existingProfile = get<{ id: string; applicant_ref: string }>(
      `SELECT ap.id, ap.applicant_ref FROM applicant_profiles ap
       JOIN person_identifiers pi ON pi.person_id = ap.person_id
       WHERE pi.id_type = 'ghana_card' AND pi.value_normalized = ?`,
      [cardNorm],
    );
    if (existingProfile) {
      return res.status(409).json({
        error: "This person is already registered. Use their record to open a new yearly support request instead of registering again.",
        existing: true,
        applicantId: existingProfile.id,
        applicantRef: existingProfile.applicant_ref,
      });
    }
  }
  let nhisNorm: string | null = null;
  if (b.nhisNumber != null && String(b.nhisNumber).trim() !== "") {
    const nhisResolved = resolveNhis(b.nhisNumber, "NHIS membership number", false);
    if ("error" in nhisResolved) return res.status(400).json({ error: nhisResolved.error });
    nhisNorm = nhisResolved.value;
  }
  const dupes = findDuplicates({
    ghanaCard: cardNorm || undefined,
    nhis: nhisNorm,
  });
  const ts = now();
  const personId = newId("per");
  const profileId = newId("apl");
  const supportKey = String(b.supportType || b.categoryCode || "");
  const categoryCode =
    registrationType === "caregiver" ? "caregivers" : SUPPORT_MAP[supportKey] || (supportKey ? SUPPORT_MAP[supportKey] : "");

  db.exec("BEGIN");
  try {
    run(
      `INSERT INTO persons (id, full_name, date_of_birth, age, sex, phone, email, home_address, photo_path, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,NULL,?,?)`,
      [
        personId,
        beneficiaryName,
        b.dateOfBirth || null,
        b.age != null && b.age !== "" ? Number(b.age) : null,
        b.sex || null,
        beneficiaryPhone.value,
        b.email || null,
        b.homeAddress || null,
        ts,
        ts,
      ],
    );
    if (cardNorm) {
      run(
        `INSERT INTO person_identifiers (id, person_id, id_type, value_normalized, verification_status, nhis_linked_to_ghana_card, created_at)
         VALUES (?,?, 'ghana_card', ?, 'declared', NULL, ?)`,
        [newId("idn"), personId, cardNorm, ts],
      );
    }
    if (nhisNorm) {
      run(
        `INSERT INTO person_identifiers (id, person_id, id_type, value_normalized, verification_status, nhis_linked_to_ghana_card, created_at)
         VALUES (?,?, 'nhis', ?, 'declared', ?, ?)`,
        [newId("idn"), personId, nhisNorm, b.nhisLinked ? 1 : 0, ts],
      );
    }
    run(
      `INSERT INTO applicant_profiles (
        id, person_id, applicant_ref, region_id, district_id, community_id, community_name, occupation, education_level,
        residence_type, residence_other, disability_category, disability_other, opd_member, opd_name, previous_fund,
        previous_fund_when, registration_type, registration_source, registered_by_user_id, client_registration_id, status, created_at, updated_at
      ) VALUES (?,?,?,?,?,NULL,?,?,?,?,?,?,?,?,?,?,?,?, 'staff', ?, ?, 'active', ?, ?)`,
      [
        profileId,
        personId,
        applicantReference(),
        district.region_id,
        district.id,
        b.communityName || null,
        b.occupation || null,
        b.educationLevel || null,
        b.residenceType || null,
        b.residenceOther || null,
        b.disabilityCategory || null,
        b.disabilityOther || null,
        b.opdMember ? 1 : 0,
        b.opdName || null,
        b.previousFund ? 1 : 0,
        b.previousFundWhen || null,
        registrationType,
        req.auth!.id,
        clientRegistrationId,
        ts,
        ts,
      ],
    );

    let caregiverPersonId: string | null = null;
    if (registrationType === "caregiver") {
      caregiverPersonId = newId("per");
      run(
        `INSERT INTO persons (id, full_name, date_of_birth, age, sex, phone, email, home_address, photo_path, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,NULL,?,?)`,
        [
          caregiverPersonId,
          b.caregiverName,
          null,
          b.caregiverAge != null && b.caregiverAge !== "" ? Number(b.caregiverAge) : null,
          b.caregiverSex || null,
          normalizedCaregiverPhone,
          null,
          b.caregiverHomeAddress || null,
          ts,
          ts,
        ],
      );
      run(
        `INSERT INTO person_identifiers (id, person_id, id_type, value_normalized, verification_status, nhis_linked_to_ghana_card, created_at)
         VALUES (?,?, 'ghana_card', ?, 'declared', NULL, ?)`,
        [newId("idn"), caregiverPersonId, normalizeIdentifier(String(b.caregiverGhanaCard)), ts],
      );
      run(
        `INSERT INTO caregiver_relationships (id, caregiver_person_id, applicant_profile_id, relationship, relationship_other, hours_of_caregiving, years_of_caregiving, community_name, status, created_at)
         VALUES (?,?,?,?,?,?,?,?, 'active', ?)`,
        [
          newId("cgr"),
          caregiverPersonId,
          profileId,
          b.caregiverRelationship || "Other",
          b.caregiverRelationshipOther || null,
          b.hoursOfCaregiving || null,
          b.yearsOfCaregiving || null,
          b.caregiverCommunityName ? String(b.caregiverCommunityName).trim() : null,
          ts,
        ],
      );
    }
    // Only carry an intake forward when the request was actually captured at registration;
    // otherwise the applicant picks the category and purpose on the application form.
    if (categoryCode && (b.supportType || b.categoryCode)) {
      const purposeSeed =
        registrationType === "caregiver"
          ? buildCaregiverPurpose(b)
          : String(b.purposeSummary || b.supportTypeOther || supportKey || "Yearly support request");
      const intake = buildRegistrationSupportIntake(
        registrationType,
        categoryCode,
        b,
        buildDetails(registrationType, categoryCode, b, caregiverPersonId),
        purposeSeed,
      );
      run("UPDATE applicant_profiles SET registration_support_intake = ?, updated_at = ? WHERE id = ?", [
        JSON.stringify(intake),
        ts,
        profileId,
      ]);
    }

    db.exec("COMMIT");

    let application: { id: string; reference: string; applicationYear: number } | null = null;
    const shouldOpenRequest = Boolean(b.openYearlyApplication) && Boolean(categoryCode);
    if (shouldOpenRequest) {
      const details = buildDetails(registrationType, categoryCode, b, caregiverPersonId);
      const purpose =
        registrationType === "caregiver"
          ? buildCaregiverPurpose(b)
          : String(b.purposeSummary || b.supportTypeOther || supportKey || "Yearly support request");
      try {
        application = createYearlyApplication({
          profileId,
          category: categoryCode,
          actor: req.auth!,
          amountRequested: b.amountRequested != null ? Number(b.amountRequested) : null,
          purposeSummary: purpose,
          details,
          year: b.applicationYear != null ? Number(b.applicationYear) : currentApplicationYear(),
        });
      } catch (e) {
        const err = e as Error & { status?: number };
        return res.status(err.status || 500).json({ error: err.message, applicantId: profileId, personId });
      }
    }

    audit({
      actorUserId: req.auth!.id,
      action: "applicant.staff_register",
      entityType: "applicant_profile",
      entityId: profileId,
      metadata: { duplicates: dupes, application, registrationType },
    });
    res.status(201).json({ id: profileId, personId, duplicates: dupes, application, registrationType });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    const message = err instanceof Error ? err.message : "";
    if (message.includes("NHIS membership number")) {
      return res.status(400).json({ error: message });
    }
    throw err;
  }
});

function upsertPersonIdentifier(
  personId: string,
  idType: "ghana_card" | "nhis",
  rawValue: unknown,
  nhisLinked?: boolean,
) {
  if (rawValue === undefined) return;
  const ts = now();
  if (rawValue === null || String(rawValue).trim() === "") {
    run("DELETE FROM person_identifiers WHERE person_id = ? AND id_type = ?", [personId, idType]);
    return;
  }
  let norm = normalizeIdentifier(String(rawValue));
  if (idType === "nhis") {
    const resolved = resolveNhis(rawValue, "NHIS membership number", false);
    if ("error" in resolved) {
      throw new Error(resolved.error);
    }
    if (resolved.value === null) {
      run("DELETE FROM person_identifiers WHERE person_id = ? AND id_type = ?", [personId, idType]);
      return;
    }
    norm = resolved.value;
  }
  const existing = get<{ id: string }>("SELECT id FROM person_identifiers WHERE person_id = ? AND id_type = ?", [
    personId,
    idType,
  ]);
  if (existing) {
    run("UPDATE person_identifiers SET value_normalized = ?, verification_status = 'declared' WHERE id = ?", [
      norm,
      existing.id,
    ]);
  } else {
    run(
      `INSERT INTO person_identifiers (id, person_id, id_type, value_normalized, verification_status, nhis_linked_to_ghana_card, created_at)
       VALUES (?,?,?,?, 'declared', ?, ?)`,
      [newId("idn"), personId, idType, norm, nhisLinked ? 1 : 0, ts],
    );
  }
}

applicantRouter.patch("/:id", requirePermission("applicants.update", "applicants.create"), (req, res) => {
  const profile = get<{
    id: string;
    person_id: string;
    region_id: string;
    district_id: string;
    registration_type: string;
    registration_support_intake: string | null;
  }>("SELECT id, person_id, region_id, district_id, registration_type, registration_support_intake FROM applicant_profiles WHERE id = ?", [
    req.params.id,
  ]);
  if (!profile) return res.status(404).json({ error: "Applicant not found" });
  if (!canAccessGeo(req.auth!, profile.region_id, profile.district_id)) {
    return res.status(403).json({ error: "Outside your geographic scope" });
  }
  const b = req.body || {};
  const ts = now();

  if (b.fullName != null && !String(b.fullName).trim()) {
    return res.status(400).json({ error: "Name of the person with disability (beneficiary) is required" });
  }
  if (profile.registration_type === "caregiver") {
    if (b.caregiverName != null && !String(b.caregiverName).trim()) {
      return res.status(400).json({ error: "Name of caregiver is required" });
    }
    if (b.caregiverGhanaCard != null && !String(b.caregiverGhanaCard).trim()) {
      return res.status(400).json({ error: "Caregiver Ghana Card is required" });
    }
  }

  let patchBeneficiaryPhone: string | null | undefined;
  if (b.phone !== undefined) {
    const resolved = resolveGhanaPhone(b.phone, "Beneficiary contact phone", false);
    if ("error" in resolved) return res.status(400).json({ error: resolved.error });
    patchBeneficiaryPhone = resolved.value;
  }
  let patchCaregiverPhone: string | null | undefined;
  if (b.caregiverPhone !== undefined) {
    const resolved = resolveGhanaPhone(b.caregiverPhone, "Caregiver contact phone", false);
    if ("error" in resolved) return res.status(400).json({ error: resolved.error });
    patchCaregiverPhone = resolved.value;
  }
  if (b.nhisNumber !== undefined && String(b.nhisNumber).trim() !== "") {
    const nhisResolved = resolveNhis(b.nhisNumber, "NHIS membership number", false);
    if ("error" in nhisResolved) return res.status(400).json({ error: nhisResolved.error });
  }

  db.exec("BEGIN");
  try {
    run(
      `UPDATE persons SET
        full_name = COALESCE(?, full_name),
        age = COALESCE(?, age),
        sex = COALESCE(?, sex),
        phone = COALESCE(?, phone),
        home_address = COALESCE(?, home_address),
        updated_at = ?
       WHERE id = ?`,
      [
        b.fullName != null ? String(b.fullName).trim() : null,
        b.age != null && b.age !== "" ? Number(b.age) : null,
        b.sex != null ? String(b.sex) : null,
        patchBeneficiaryPhone !== undefined ? patchBeneficiaryPhone : null,
        b.homeAddress != null ? String(b.homeAddress).trim() : null,
        ts,
        profile.person_id,
      ],
    );

    run(
      `UPDATE applicant_profiles SET
        community_name = COALESCE(?, community_name),
        occupation = COALESCE(?, occupation),
        education_level = COALESCE(?, education_level),
        residence_type = COALESCE(?, residence_type),
        residence_other = COALESCE(?, residence_other),
        disability_category = COALESCE(?, disability_category),
        disability_other = COALESCE(?, disability_other),
        opd_member = COALESCE(?, opd_member),
        opd_name = COALESCE(?, opd_name),
        previous_fund = COALESCE(?, previous_fund),
        previous_fund_when = COALESCE(?, previous_fund_when),
        updated_at = ?
       WHERE id = ?`,
      [
        b.communityName != null ? String(b.communityName).trim() : null,
        b.occupation != null ? String(b.occupation).trim() : null,
        b.educationLevel != null ? String(b.educationLevel).trim() : null,
        b.residenceType != null ? String(b.residenceType) : null,
        b.residenceOther != null ? String(b.residenceOther).trim() : null,
        b.disabilityCategory != null ? String(b.disabilityCategory) : null,
        b.disabilityOther != null ? String(b.disabilityOther).trim() : null,
        b.opdMember != null ? (b.opdMember ? 1 : 0) : null,
        b.opdName != null ? String(b.opdName).trim() : null,
        b.previousFund != null ? (b.previousFund ? 1 : 0) : null,
        b.previousFundWhen != null ? String(b.previousFundWhen).trim() : null,
        ts,
        profile.id,
      ],
    );

    upsertPersonIdentifier(profile.person_id, "ghana_card", b.ghanaCard);
    upsertPersonIdentifier(profile.person_id, "nhis", b.nhisNumber, Boolean(b.nhisLinked));

    let caregiverPersonId: string | null = null;
    if (profile.registration_type === "caregiver") {
      const rel = get<{
        id: string;
        caregiver_person_id: string;
      }>(
        `SELECT id, caregiver_person_id FROM caregiver_relationships
         WHERE applicant_profile_id = ? AND status = 'active' LIMIT 1`,
        [profile.id],
      );
      if (rel) {
        caregiverPersonId = rel.caregiver_person_id;
        run(
          `UPDATE persons SET
            full_name = COALESCE(?, full_name),
            age = COALESCE(?, age),
            sex = COALESCE(?, sex),
            phone = COALESCE(?, phone),
            home_address = COALESCE(?, home_address),
            updated_at = ?
           WHERE id = ?`,
          [
            b.caregiverName != null ? String(b.caregiverName).trim() : null,
            b.caregiverAge != null && b.caregiverAge !== "" ? Number(b.caregiverAge) : null,
            b.caregiverSex != null ? String(b.caregiverSex) : null,
            patchCaregiverPhone !== undefined ? patchCaregiverPhone : null,
            b.caregiverHomeAddress != null ? String(b.caregiverHomeAddress).trim() : null,
            ts,
            rel.caregiver_person_id,
          ],
        );
        run(
          `UPDATE caregiver_relationships SET
            relationship = COALESCE(?, relationship),
            relationship_other = COALESCE(?, relationship_other),
            hours_of_caregiving = COALESCE(?, hours_of_caregiving),
            years_of_caregiving = COALESCE(?, years_of_caregiving),
            community_name = COALESCE(?, community_name)
           WHERE id = ?`,
          [
            b.caregiverRelationship != null ? String(b.caregiverRelationship) : null,
            b.caregiverRelationshipOther != null ? String(b.caregiverRelationshipOther).trim() : null,
            b.hoursOfCaregiving != null ? String(b.hoursOfCaregiving).trim() : null,
            b.yearsOfCaregiving != null ? String(b.yearsOfCaregiving).trim() : null,
            b.caregiverCommunityName != null ? String(b.caregiverCommunityName).trim() : null,
            rel.id,
          ],
        );
        upsertPersonIdentifier(rel.caregiver_person_id, "ghana_card", b.caregiverGhanaCard);
      }

    }

    db.exec("COMMIT");
    audit({ actorUserId: req.auth!.id, action: "applicant.update", entityType: "applicant_profile", entityId: profile.id });
    res.json({ id: profile.id, updated: true });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    const message = err instanceof Error ? err.message : "";
    if (message.includes("NHIS membership number")) {
      return res.status(400).json({ error: message });
    }
    throw err;
  }
});

applicantRouter.post("/:id/yearly-requests", requirePermission("applications.create", "applicants.create"), (req, res) => {
  const profile = get<{ id: string; region_id: string; district_id: string }>("SELECT id, region_id, district_id FROM applicant_profiles WHERE id = ?", [
    req.params.id,
  ]);
  if (!profile) return res.status(404).json({ error: "Applicant not found" });
  if (!canAccessGeo(req.auth!, profile.region_id, profile.district_id)) {
    return res.status(403).json({ error: "Outside your geographic scope" });
  }
  const b = req.body || {};
  const category = String(b.categoryCode || SUPPORT_MAP[String(b.supportType || "")] || "");
  if (!category) return res.status(400).json({ error: "Support category is required" });
  try {
    const created = createYearlyApplication({
      profileId: profile.id,
      category,
      actor: req.auth!,
      amountRequested: b.amountRequested != null ? Number(b.amountRequested) : null,
      purposeSummary: b.purposeSummary || null,
      details: b.details || {},
      year: b.applicationYear != null ? Number(b.applicationYear) : currentApplicationYear(),
    });
    audit({ actorUserId: req.auth!.id, action: "application.yearly_request", entityType: "application", entityId: created.id });
    res.status(201).json(created);
  } catch (e) {
    const err = e as Error & { status?: number; details?: unknown };
    res.status(err.status || 500).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
});

applicantRouter.post("/:id/caregivers", requirePermission("applicants.update", "applicants.create"), (req, res) => {
  const profile = get<{ id: string; region_id: string; district_id: string }>("SELECT id, region_id, district_id FROM applicant_profiles WHERE id = ?", [
    req.params.id,
  ]);
  if (!profile) return res.status(404).json({ error: "Applicant not found" });
  if (!canAccessGeo(req.auth!, profile.region_id, profile.district_id)) {
    return res.status(403).json({ error: "Outside your geographic scope" });
  }
  const existing = get<{ id: string }>(
    "SELECT id FROM caregiver_relationships WHERE applicant_profile_id = ? AND status = 'active'",
    [profile.id],
  );
  if (existing) {
    return res.status(409).json({ error: "This applicant already has a caregiver. Only one caregiver is allowed." });
  }
  const b = req.body || {};
  if (!b.fullName || !b.ghanaCard) return res.status(400).json({ error: "Caregiver name and Ghana Card are required" });
  const ts = now();
  const personId = newId("per");
  run(
    `INSERT INTO persons (id, full_name, date_of_birth, age, sex, phone, email, home_address, photo_path, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,NULL,?,?)`,
    [personId, b.fullName, b.dateOfBirth || null, b.age || null, b.sex || null, b.phone || null, b.email || null, b.homeAddress || null, ts, ts],
  );
  run(
    `INSERT INTO person_identifiers (id, person_id, id_type, value_normalized, verification_status, nhis_linked_to_ghana_card, created_at)
     VALUES (?,?, 'ghana_card', ?, 'declared', NULL, ?)`,
    [newId("idn"), personId, normalizeIdentifier(String(b.ghanaCard)), ts],
  );
  const relId = newId("cgr");
  run(
    `INSERT INTO caregiver_relationships (id, caregiver_person_id, applicant_profile_id, relationship, relationship_other, hours_of_caregiving, years_of_caregiving, status, created_at)
     VALUES (?,?,?,?,?,?,?, 'active', ?)`,
    [relId, personId, profile.id, b.relationship || "Other", b.relationshipOther || null, b.hoursOfCaregiving || null, b.yearsOfCaregiving || null, ts],
  );
  audit({ actorUserId: req.auth!.id, action: "caregiver.link", entityType: "caregiver_relationship", entityId: relId });
  res.status(201).json({ id: relId, personId });
});

function buildCaregiverPurpose(b: Record<string, unknown>): string {
  const purpose = String(b.caregiverPurpose || "");
  const other = String(b.caregiverPurposeOther || "");
  const support = supportTypeLabel(String(b.supportType || ""));
  const base = purpose === "Other" && other ? `Other: ${other}` : purpose || other || "Caregivers support";
  return support ? `${base} · Support: ${support}` : base;
}

function supportTypeLabel(code: string): string {
  const map: Record<string, string> = {
    education: "Education",
    economic_empowerment: "Economic Empowerment",
    health: "Health",
    assistive_device: "Assistive Device",
    other: "Other",
  };
  return map[code] || code;
}

function buildCaregiverSupportAssessment(b: Record<string, unknown>): string {
  const lines: string[] = [];
  const support = String(b.supportType || "");
  if (support) lines.push(`Type of support applied for: ${supportTypeLabel(support)}${b.supportTypeOther ? ` (${b.supportTypeOther})` : ""}`);
  if (support === "education") {
    if (b.educationMode) lines.push(`Education mode: ${b.educationMode}`);
    if (b.educationLevelFormal) lines.push(`Formal level: ${b.educationLevelFormal}`);
    if (b.enrolmentStatus) lines.push(`Enrolment: ${b.enrolmentStatus}`);
    if (b.apprenticeshipType) lines.push(`Apprenticeship: ${b.apprenticeshipType}`);
  }
  if (support === "economic_empowerment") {
    if (b.businessStage) lines.push(`Business: ${b.businessStage}`);
    if (b.businessActivity) lines.push(`Business activity: ${b.businessActivity}`);
  }
  if (support === "health") {
    if (b.healthPurpose) lines.push(`Health: ${b.healthPurpose}${b.healthPurposeOther ? ` (${b.healthPurposeOther})` : ""}`);
  }
  if (support === "assistive_device") {
    const device = b.assistiveDeviceType === "Other" ? b.assistiveDeviceOther : b.assistiveDeviceType;
    if (device) lines.push(`Assistive device: ${device}`);
    if (b.alreadyReceivingAssistive) lines.push(`Already receiving assistive support: ${b.alreadyReceivingAssistive}`);
    if (b.existingAssistiveDetail) lines.push(`Existing support: ${b.existingAssistiveDetail}`);
    if (b.prescribedWhere) lines.push(`Prescribed where: ${b.prescribedWhere}`);
  }
  if (b.caregiverPurposeOther) lines.push(`Purpose other: ${b.caregiverPurposeOther}`);
  if (b.supportingInfo) lines.push(`Supporting info: ${b.supportingInfo}`);
  return lines.join("\n");
}

function buildDetails(
  registrationType: string,
  category: string,
  b: Record<string, unknown>,
  caregiverPersonId: string | null,
): Record<string, unknown> {
  if (registrationType === "caregiver" || category === "caregivers") {
    return {
      caregiverPersonId,
      caregiverGhanaCard: b.caregiverGhanaCard || null,
      pwdNhisNumber: b.nhisNumber || null,
      relationship: b.caregiverRelationship || null,
      relationshipOther: b.caregiverRelationshipOther || null,
      hoursOfCaregiving: b.hoursOfCaregiving || null,
      yearsOfCaregiving: b.yearsOfCaregiving || null,
      caregiverEducationLevel: b.caregiverEducationLevel || null,
      caregiverResidenceType: b.caregiverResidenceType || null,
      caregiverResidenceOther: b.caregiverResidenceOther || null,
      purpose: b.caregiverPurpose || null,
      purposeOther: buildCaregiverSupportAssessment(b) || b.caregiverPurposeOther || b.supportingInfo || null,
    };
  }
  if (category === "education") {
    return {
      educationMode: b.educationMode || null,
      educationLevel: b.educationLevelFormal || b.educationLevel || null,
      enrolmentStatus: b.enrolmentStatus || null,
      apprenticeshipType: b.apprenticeshipType || null,
      supportType: b.educationMode === "Informal" ? "Apprenticeship" : "School fees",
    };
  }
  if (category === "health") {
    return {
      healthPurpose: b.healthPurpose || null,
      healthPurposeOther: b.healthPurposeOther || null,
      healthcareProvider: b.healthcareProvider || null,
      nhisNumber: b.nhisNumber || null,
    };
  }
  if (category === "assistive_device") {
    return {
      healthPurpose: "Assistive device",
      assistiveDeviceType: b.assistiveDeviceType === "Other" ? b.assistiveDeviceOther : b.assistiveDeviceType,
      alreadyReceivingAssistive: b.alreadyReceivingAssistive === "yes" || b.alreadyReceivingAssistive === true,
      existingAssistiveDetail: b.existingAssistiveDetail || null,
      prescribedWhere: b.prescribedWhere || null,
    };
  }
  if (category === "income_generating") {
    const stage = b.businessStage || null;
    return {
      subtype: stage === "Business Expansion" ? "startup_capital" : "startup_capital",
      businessStage: stage,
      businessActivity: b.businessActivity || b.supportTypeOther || null,
      itemSpecification: b.itemSpecification || null,
    };
  }
  return b.details && typeof b.details === "object" ? (b.details as Record<string, unknown>) : {};
}
