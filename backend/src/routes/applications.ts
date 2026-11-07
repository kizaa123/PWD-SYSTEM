import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { all, db, get, now, run } from "../db/index.ts";
import { COVERAGE_DISTRICT_CODE } from "../db/policy.ts";
import {
  validateAssistiveDeviceDetails,
  validateAssistiveDeviceNotPreviouslyApplied,
} from "../lib/assistive-device-policy.ts";
import {
  applicantProfileIdsAppliedForYear,
  clearCategoryDetails,
  createYearlyApplication,
  currentApplicationYear,
  saveCategoryDetails,
} from "../lib/applications-core.ts";
import { audit } from "../lib/audit.ts";
import { canAccessGeo, geoFilterSql, requireAuth, requirePermission, type AuthUser } from "../lib/auth.ts";
import { newId, normalizeIdentifier } from "../lib/crypto.ts";
import { canViewApplicationStatus, sqlStatusFilter } from "../lib/workflow-access.ts";
import { changeStatus, findDuplicates } from "../lib/workflow.ts";

import { uploadsDir } from "../lib/paths.ts";

const uploadRoot = uploadsDir();
fs.mkdirSync(uploadRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${newId("file")}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /pdf|jpeg|jpg|png|webp|doc|docx/i.test(file.mimetype) || /\.(pdf|jpe?g|png|webp|docx?)$/i.test(file.originalname);
    cb(ok ? null : new Error("Unsupported file type"), ok);
  },
});

export const applicationRouter = Router();
applicationRouter.use(requireAuth);

function getOwnProfileId(user: AuthUser): string | undefined {
  if (!user.person_id) return undefined;
  return get<{ id: string }>("SELECT id FROM applicant_profiles WHERE person_id = ?", [user.person_id])?.id;
}

function loadApplication(id: string) {
  const app = get<Record<string, unknown>>(
    `SELECT a.*, p.full_name, p.phone, p.sex, p.age, p.email, p.home_address, p.photo_path,
            ap.applicant_ref, ap.disability_category, ap.person_id, ap.community_name, ap.registration_type,
            (SELECT p_c.photo_path FROM caregiver_relationships cr
             JOIN persons p_c ON p_c.id = cr.caregiver_person_id
             WHERE cr.applicant_profile_id = ap.id AND cr.status = 'active' LIMIT 1) AS caregiver_photo_path,
            r.name AS region_name, d.name AS district_name, sc.name AS category_name,
            COALESCE(rp.full_name, rpc.full_name) AS endorsed_by_name
     FROM applications a
     JOIN applicant_profiles ap ON ap.id = a.applicant_profile_id
     JOIN persons p ON p.id = ap.person_id
     JOIN regions r ON r.id = a.region_id
     JOIN districts d ON d.id = a.district_id
     JOIN support_categories sc ON sc.code = a.category_code
     LEFT JOIN users ru ON ru.id = ap.registered_by_user_id
     LEFT JOIN persons rp ON rp.id = ru.person_id
     LEFT JOIN users cu ON cu.id = a.created_by_user_id
     LEFT JOIN persons rpc ON rpc.id = cu.person_id
     WHERE a.id = ?`,
    [id],
  );
  if (!app) return null;
  const details =
    app.category_code === "education"
      ? get("SELECT * FROM education_details WHERE application_id = ?", [id])
      : app.category_code === "health" || app.category_code === "assistive_device"
        ? get("SELECT * FROM health_details WHERE application_id = ?", [id])
        : app.category_code === "income_generating"
          ? get("SELECT * FROM income_activity_details WHERE application_id = ?", [id])
          : get("SELECT * FROM caregiver_support_details WHERE application_id = ?", [id]);
  const documents = all("SELECT id, document_type, original_name, mime_type, size_bytes, is_medical, verification_status, created_at FROM documents WHERE application_id = ?", [id]);
  const events = all(
    `SELECT e.*, u.email AS actor_email FROM application_events e LEFT JOIN users u ON u.id = e.actor_user_id
     WHERE e.application_id = ? ORDER BY e.created_at ASC`,
    [id],
  );
  const verifications = all("SELECT * FROM verifications WHERE application_id = ? ORDER BY created_at DESC", [id]);
  const assessments = all("SELECT * FROM assessments WHERE application_id = ? ORDER BY version DESC", [id]);
  const decisions = all("SELECT * FROM decisions WHERE application_id = ? ORDER BY created_at DESC", [id]);
  const disbursements = all("SELECT * FROM disbursements WHERE application_id = ? ORDER BY created_at DESC", [id]);
  const fulfilments = all("SELECT * FROM fulfilments WHERE application_id = ? ORDER BY created_at DESC", [id]);
  return { ...app, details, documents, events, verifications, assessments, decisions, disbursements, fulfilments };
}

function assertAppAccess(user: AuthUser, app: { region_id: string; district_id: string; applicant_profile_id: string }, write = false) {
  const own = getOwnProfileId(user) === app.applicant_profile_id;
  if (own && !write) return;
  if (own && write) return;
  if (!canAccessGeo(user, app.region_id, app.district_id)) {
    const err = Object.assign(new Error("Outside your geographic scope"), { status: 403 });
    throw err;
  }
}

applicationRouter.get("/", requirePermission("applications.read", "profile.self.read"), (req, res) => {
  const user = req.auth!;
  const status = String(req.query.status || "");
  const category = String(req.query.category || "");
  const q = String(req.query.q || "");
  const yearQuery = req.query.year;
  const activeYearOnly = req.query.activeYearOnly === "1" || req.query.activeYearOnly === "true";
  const intakeFolder = req.query.intakeFolder === "1" || req.query.intakeFolder === "true";
  let sql = `SELECT a.id, a.applicant_profile_id, a.reference, a.category_code, a.status, a.application_year, a.amount_requested_pesewas, a.amount_approved_pesewas,
                    a.created_at, a.submitted_at, a.purpose_summary, a.region_id, a.district_id, a.office_use_qualified,
                    p.full_name, ap.applicant_ref, r.name AS region_name, d.name AS district_name, sc.name AS category_name,
                    COALESCE(rp.full_name, rpc.full_name) AS endorsed_by_name
             FROM applications a
             JOIN applicant_profiles ap ON ap.id = a.applicant_profile_id
             JOIN persons p ON p.id = ap.person_id
             JOIN regions r ON r.id = a.region_id
             JOIN districts d ON d.id = a.district_id
             JOIN support_categories sc ON sc.code = a.category_code
             LEFT JOIN users ru ON ru.id = ap.registered_by_user_id
             LEFT JOIN persons rp ON rp.id = ru.person_id
             LEFT JOIN users cu ON cu.id = a.created_by_user_id
             LEFT JOIN persons rpc ON rpc.id = cu.person_id`;
  const params: string[] = [];
  const where: string[] = [];
  if (user.roles.includes("applicant") || user.roles.includes("caregiver")) {
    const pid = getOwnProfileId(user);
    where.push("a.applicant_profile_id = ?");
    params.push(pid || "__none__");
  } else {
    const geo = geoFilterSql(user);
    where.push(geo.sql);
    params.push(...geo.params);
  }
  const phaseFilter = sqlStatusFilter(user);
  const skipPhaseFilter = intakeFolder || (activeYearOnly && !status);
  if (phaseFilter && !skipPhaseFilter) {
    where.push(phaseFilter.sql);
    params.push(...phaseFilter.params);
  }
  if (yearQuery) {
    where.push("a.application_year = ?");
    params.push(Number(yearQuery));
  }
  if (activeYearOnly) {
    where.push("a.status NOT IN ('cancelled', 'rejected')");
    if (!yearQuery) {
      where.push("a.application_year = ?");
      params.push(currentApplicationYear());
    }
  }
  if (status) {
    if (!canViewApplicationStatus(user, status)) {
      return res.json([]);
    }
    where.push("a.status = ?");
    params.push(status);
  }
  if (category) {
    where.push("a.category_code = ?");
    params.push(category);
  }
  if (q) {
    where.push("(a.reference LIKE ? OR p.full_name LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  sql += ` WHERE ${where.join(" AND ")} ORDER BY a.updated_at DESC LIMIT 300`;
  const year = currentApplicationYear();
  const appliedThisYear = applicantProfileIdsAppliedForYear(year);
  const rows = all<Record<string, unknown>>(sql, params).map((row) => ({
    ...row,
    applied_current_year: appliedThisYear.has(row.applicant_profile_id as string),
    cycle_year: year,
  }));
  res.json(rows);
});

applicationRouter.get("/:id", requirePermission("applications.read", "profile.self.read"), (req, res) => {
  const app = loadApplication(req.params.id);
  if (!app) return res.status(404).json({ error: "Application not found" });
  try {
    assertAppAccess(req.auth!, app as { region_id: string; district_id: string; applicant_profile_id: string });
  } catch (e) {
    return res.status((e as { status?: number }).status || 403).json({ error: (e as Error).message });
  }
  const identifiers = all<{ id_type: string; value_normalized: string }>(
    "SELECT id_type, value_normalized FROM person_identifiers WHERE person_id = ?",
    [app.person_id as string],
  );
  const ghanaCard = identifiers.find((i) => i.id_type === "ghana_card")?.value_normalized;
  const nhis = identifiers.find((i) => i.id_type === "nhis")?.value_normalized;
  const duplicates = findDuplicates({
    ghanaCard: ghanaCard ? normalizeIdentifier(ghanaCard) : null,
    nhis: nhis ? normalizeIdentifier(nhis) : null,
    personId: app.person_id as string,
    category: app.category_code as string,
    excludeApplicationId: app.id as string,
  });
  const docs = (app.documents as { is_medical: number }[]).filter((d) => {
    if (!d.is_medical) return true;
    return req.auth!.permissions.includes("documents.read_medical") || req.auth!.roles.includes("applicant");
  });
  res.json({ ...app, documents: docs, duplicates });
});

applicationRouter.post("/", requirePermission("applications.create"), (req, res) => {
  const b = req.body || {};
  const user = req.auth!;
  if (user.roles.includes("caregiver") && !user.permissions.includes("applicants.create")) {
    return res.status(403).json({ error: "A caregiver or family member cannot apply on behalf of a person with disability" });
  }
  if (Array.isArray(b.categoryCode) || Array.isArray(b.categoryCodes) || Array.isArray(b.categories)) {
    return res.status(400).json({ error: "An application can include only one support category" });
  }
  let profileId = String(b.applicantProfileId || "");
  if (user.roles.includes("applicant")) {
    profileId = getOwnProfileId(user) || "";
  }
  const profile = get<{ id: string; region_id: string; district_id: string; person_id: string }>(
    "SELECT id, region_id, district_id, person_id FROM applicant_profiles WHERE id = ?",
    [profileId],
  );
  if (!profile) return res.status(400).json({ error: "Applicant profile is required" });
  if (!user.roles.includes("applicant") && !canAccessGeo(user, profile.region_id, profile.district_id)) {
    return res.status(403).json({ error: "Outside your geographic scope" });
  }
  if (profile.district_id) {
    const covered = get<{ code: string }>("SELECT code FROM districts WHERE id = ? AND is_active = 1", [profile.district_id]);
    if (!covered || covered.code !== COVERAGE_DISTRICT_CODE) {
      return res.status(400).json({ error: "Applications are not open for this municipal area" });
    }
  }
  const category = String(b.categoryCode || "");
  if (!category || category.includes(",")) {
    return res.status(400).json({ error: "Select one support category" });
  }
  const year = b.applicationYear != null ? Number(b.applicationYear) : currentApplicationYear();
  if (category === "assistive_device") {
    const details = (b.details || {}) as Record<string, unknown>;
    const detailErr = validateAssistiveDeviceDetails(details);
    if (detailErr) return res.status(400).json({ error: detailErr });
    const key = String(details.assistiveDeviceKey || "");
    const repeatErr = validateAssistiveDeviceNotPreviouslyApplied(profile.id, key);
    if (repeatErr) return res.status(400).json({ error: repeatErr });
  }
  try {
    const created = createYearlyApplication({
      profileId: profile.id,
      category,
      actor: user,
      amountRequested: b.amountRequested != null ? Number(b.amountRequested) : null,
      purposeSummary: b.purposeSummary || null,
      applicantSignatureLabel: b.applicantSignatureLabel ?? null,
      endorsingOfficerName: b.endorsingOfficerName ?? null,
      endorsedAt: b.endorsedAt ?? null,
      officeUseQualified: b.officeUseQualified ?? null,
      officeUseRemarks: b.officeUseRemarks ?? null,
      details: b.details || {},
      year,
    });
    run("UPDATE applicant_profiles SET registration_support_intake = NULL, updated_at = ? WHERE id = ?", [
      now(),
      profile.id,
    ]);
    audit({ actorUserId: user.id, action: "application.create", entityType: "application", entityId: created.id });
    res.status(201).json(loadApplication(created.id));
  } catch (e) {
    const err = e as Error & { status?: number; details?: unknown };
    return res.status(err.status || 500).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
});

applicationRouter.patch("/:id", requirePermission("applications.create", "profile.self.write"), (req, res) => {
  const app = get<{ id: string; status: string; category_code: string; region_id: string; district_id: string; applicant_profile_id: string }>(
    "SELECT id, status, category_code, region_id, district_id, applicant_profile_id FROM applications WHERE id = ?",
    [req.params.id],
  );
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (!["registration", "returned_for_correction"].includes(app.status)) {
    return res.status(400).json({ error: "Only registration-phase or returned applications can be edited" });
  }
  try {
    assertAppAccess(req.auth!, app, true);
  } catch (e) {
    return res.status((e as { status?: number }).status || 403).json({ error: (e as Error).message });
  }
  const b = req.body || {};
  const amount = b.amountRequested != null ? Math.round(Number(b.amountRequested) * 100) : null;

  // The support category is chosen on the application form, so a registration-phase
  // request can still be moved to the category the applicant actually needs.
  let category = app.category_code;
  if (b.categoryCode && String(b.categoryCode) !== app.category_code) {
    category = String(b.categoryCode);
    if (!get("SELECT code FROM support_categories WHERE code = ? AND is_active = 1", [category])) {
      return res.status(400).json({ error: "Unknown support category" });
    }
    clearCategoryDetails(app.id, app.category_code);
  }

  if (category === "assistive_device") {
    const details = (b.details || {}) as Record<string, unknown>;
    const detailErr = validateAssistiveDeviceDetails(details);
    if (detailErr) return res.status(400).json({ error: detailErr });
    const key = String(details.assistiveDeviceKey || "");
    const repeatErr = validateAssistiveDeviceNotPreviouslyApplied(app.applicant_profile_id, key, app.id);
    if (repeatErr) return res.status(400).json({ error: repeatErr });
  }

  run(
    `UPDATE applications SET category_code = ?, purpose_summary = ?, amount_requested_pesewas = ?, applicant_signature_label = ?,
       endorsing_officer_name = ?, endorsed_at = ?, office_use_qualified = ?, office_use_remarks = ?, updated_at = ?
     WHERE id = ?`,
    [
      category,
      b.purposeSummary ?? null,
      amount,
      b.applicantSignatureLabel != null ? String(b.applicantSignatureLabel) : null,
      b.endorsingOfficerName != null ? String(b.endorsingOfficerName) : null,
      now(),
      b.officeUseQualified === "qualified" || b.officeUseQualified === "not_qualified" ? b.officeUseQualified : null,
      b.officeUseRemarks != null ? String(b.officeUseRemarks) : null,
      now(),
      app.id,
    ],
  );
  if (b.details) saveCategoryDetails(app.id, category, b.details);
  audit({ actorUserId: req.auth!.id, action: "application.update", entityType: "application", entityId: app.id });
  res.json(loadApplication(app.id));
});

applicationRouter.post("/:id/submit", requirePermission("applications.submit"), (req, res) => {
  const app = loadApplication(req.params.id);
  if (!app) return res.status(404).json({ error: "Application not found" });
  try {
    assertAppAccess(req.auth!, app as { region_id: string; district_id: string; applicant_profile_id: string }, true);
  } catch (e) {
    return res.status((e as { status?: number }).status || 403).json({ error: (e as Error).message });
  }
  const errors = validateForSubmit(app);
  if (errors.length) return res.status(400).json({ error: "Application is incomplete", errors });
  const from = app.status as string;
  if (!["registration", "returned_for_correction"].includes(from)) {
    return res.status(400).json({ error: "This request is not in the registration phase" });
  }
  changeStatus({
    applicationId: app.id as string,
    to: "interview",
    actor: req.auth!,
    note: from === "returned_for_correction" ? "Resubmitted — moved to interview" : "Registration complete — queued for interview",
  });
  run("UPDATE applications SET submitted_at = ?, updated_at = ? WHERE id = ?", [now(), now(), app.id as string]);
  audit({ actorUserId: req.auth!.id, action: "application.submit", entityType: "application", entityId: app.id as string });
  res.json(loadApplication(app.id as string));
});

applicationRouter.post("/:id/verify", requirePermission("verification.perform"), (req, res) => {
  const app = get<{ id: string; status: string; region_id: string; district_id: string }>("SELECT id, status, region_id, district_id FROM applications WHERE id = ?", [req.params.id]);
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (!canAccessGeo(req.auth!, app.region_id, app.district_id)) return res.status(403).json({ error: "Outside your geographic scope" });
  if (app.status !== "interview") {
    return res.status(400).json({ error: "This application is not in the interview phase" });
  }
  const b = req.body || {};
  const outcome = String(b.outcome || "verified");
  run(
    `INSERT INTO verifications (id, application_id, officer_user_id, identity_ok, documents_ok, duplicate_flag, duplicate_note, completeness_ok, outcome, comments, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [newId("ver"), app.id, req.auth!.id, b.identityOk ? 1 : 0, b.documentsOk ? 1 : 0, b.duplicateFlag ? 1 : 0, b.duplicateNote || null, b.completenessOk ? 1 : 0, outcome, b.comments || null, now()],
  );
  if (outcome === "returned") {
    changeStatus({ applicationId: app.id, to: "returned_for_correction", actor: req.auth!, note: b.comments || "Returned for correction" });
  } else {
    if (b.findings || b.recommendedAmount != null) {
      const versionRow = get<{ v: number }>("SELECT COALESCE(MAX(version),0) AS v FROM assessments WHERE application_id = ?", [app.id]);
      const version = (versionRow?.v || 0) + 1;
      const recommended = b.recommendedAmount != null ? Math.round(Number(b.recommendedAmount) * 100) : null;
      run(
        `INSERT INTO assessments (id, application_id, officer_user_id, version, findings, recommended_amount_pesewas, recommended_items, recommendation, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [newId("asm"), app.id, req.auth!.id, version, b.findings || null, recommended, b.recommendedItems || null, "approve", now()],
      );
    }
    changeStatus({ applicationId: app.id, to: "selection", actor: req.auth!, note: b.comments || "Interview complete — sent to selection" });
  }
  audit({ actorUserId: req.auth!.id, action: "application.verify", entityType: "application", entityId: app.id, metadata: { outcome } });
  res.json(loadApplication(app.id));
});

applicationRouter.post("/:id/assess", requirePermission("assessment.perform"), (req, res) => {
  const app = get<{ id: string; region_id: string; district_id: string }>("SELECT id, region_id, district_id FROM applications WHERE id = ?", [req.params.id]);
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (!canAccessGeo(req.auth!, app.region_id, app.district_id)) return res.status(403).json({ error: "Outside your geographic scope" });
  const current = get<{ status: string }>("SELECT status FROM applications WHERE id = ?", [app.id]);
  if (current?.status !== "interview") {
    return res.status(400).json({ error: "This application is not in the interview phase" });
  }
  const b = req.body || {};
  const versionRow = get<{ v: number }>("SELECT COALESCE(MAX(version),0) AS v FROM assessments WHERE application_id = ?", [app.id]);
  const version = (versionRow?.v || 0) + 1;
  const recommended = b.recommendedAmount != null ? Math.round(Number(b.recommendedAmount) * 100) : null;
  const recommendation = String(b.recommendation || "approve");
  run(
    `INSERT INTO assessments (id, application_id, officer_user_id, version, findings, recommended_amount_pesewas, recommended_items, recommendation, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [newId("asm"), app.id, req.auth!.id, version, b.findings || null, recommended, b.recommendedItems || null, recommendation, now()],
  );
  if (recommendation === "reject") {
    changeStatus({ applicationId: app.id, to: "rejected", actor: req.auth!, note: b.findings || "Not recommended after interview" });
  } else {
    changeStatus({ applicationId: app.id, to: "selection", actor: req.auth!, note: b.findings || "Interview complete — sent to selection" });
  }
  audit({ actorUserId: req.auth!.id, action: "application.assess", entityType: "application", entityId: app.id });
  res.json(loadApplication(app.id));
});

applicationRouter.post("/:id/decide", requirePermission("decision.approve"), (req, res) => {
  const app = get<{ id: string; status: string; region_id: string; district_id: string; amount_requested_pesewas: number | null }>(
    "SELECT id, status, region_id, district_id, amount_requested_pesewas FROM applications WHERE id = ?",
    [req.params.id],
  );
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (!canAccessGeo(req.auth!, app.region_id, app.district_id)) return res.status(403).json({ error: "Outside your geographic scope" });
  if (!req.auth!.roles.includes("fund_committee")) {
    return res.status(403).json({ error: "Only the Disability Fund Management Committee can make the final decision" });
  }
  if (app.status !== "selection") {
    return res.status(400).json({ error: "This application is not in the selection phase" });
  }
  const b = req.body || {};
  const outcome = String(b.outcome || "");
  if (!["approved", "rejected", "returned", "escalated"].includes(outcome)) {
    return res.status(400).json({ error: "Outcome must be approved, rejected, returned or escalated" });
  }
  if (!b.reason) return res.status(400).json({ error: "A reason is required for every decision" });
  const amount = b.authorizedAmount != null ? Math.round(Number(b.authorizedAmount) * 100) : app.amount_requested_pesewas;
  const latestAssessment = get<{ id: string }>("SELECT id FROM assessments WHERE application_id = ? ORDER BY version DESC LIMIT 1", [app.id]);
  run(
    `INSERT INTO decisions (id, application_id, officer_user_id, assessment_id, outcome, reason, authorized_amount_pesewas, authorized_items, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [newId("dec"), app.id, req.auth!.id, latestAssessment?.id || null, outcome, b.reason, outcome === "approved" ? amount : null, b.authorizedItems || null, now()],
  );
  if (outcome === "rejected") {
    changeStatus({ applicationId: app.id, to: "rejected", actor: req.auth!, note: b.reason });
  } else if (outcome === "returned") {
    changeStatus({ applicationId: app.id, to: "returned_for_correction", actor: req.auth!, note: b.reason });
  } else if (outcome === "escalated") {
    changeStatus({ applicationId: app.id, to: "on_hold", actor: req.auth!, note: b.reason || "Escalated for further review" });
  } else {
    changeStatus({
      applicationId: app.id,
      to: "disbursement",
      actor: req.auth!,
      note: b.reason,
      extra: { amountApproved: amount },
    });
  }
  audit({ actorUserId: req.auth!.id, action: "application.decide", entityType: "application", entityId: app.id, metadata: { outcome, amount } });
  res.json(loadApplication(app.id));
});

applicationRouter.post("/:id/disburse", requirePermission("fulfilment.record"), (req, res) => {
  const app = get<{ id: string; status: string; region_id: string; district_id: string; amount_approved_pesewas: number | null }>(
    "SELECT id, status, region_id, district_id, amount_approved_pesewas FROM applications WHERE id = ?",
    [req.params.id],
  );
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (!canAccessGeo(req.auth!, app.region_id, app.district_id)) return res.status(403).json({ error: "Outside your geographic scope" });
  if (!["disbursement", "partially_fulfilled"].includes(app.status)) {
    return res.status(400).json({ error: "This application is not in the disbursement phase" });
  }
  const b = req.body || {};
  const amount = Math.round(Number(b.amount) * 100);
  if (!amount || amount <= 0) return res.status(400).json({ error: "Disbursement amount is required" });
  const paid = get<{ t: number }>("SELECT COALESCE(SUM(amount_pesewas),0) AS t FROM disbursements WHERE application_id = ?", [app.id])?.t || 0;
  const cap = app.amount_approved_pesewas || 0;
  if (paid + amount > cap) return res.status(400).json({ error: "Cannot disburse more than the authorized amount" });
  const decision = get<{ id: string }>("SELECT id FROM decisions WHERE application_id = ? AND outcome = 'approved' ORDER BY created_at DESC LIMIT 1", [app.id]);
  run(
    `INSERT INTO disbursements (id, application_id, decision_id, officer_user_id, amount_pesewas, channel, recipient_name, recipient_account, reference_no, notes, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [newId("dis"), app.id, decision?.id || null, req.auth!.id, amount, b.channel || null, b.recipientName || null, b.recipientAccount || null, b.referenceNo || null, b.notes || null, now()],
  );
  const newTotal = paid + amount;
  const next = newTotal >= cap ? "completed" : "partially_fulfilled";
  if (app.status !== next) changeStatus({ applicationId: app.id, to: next, actor: req.auth!, note: b.notes || "Disbursement recorded" });
  audit({ actorUserId: req.auth!.id, action: "application.disburse", entityType: "application", entityId: app.id, metadata: { amount } });
  res.json(loadApplication(app.id));
});

applicationRouter.post("/:id/fulfil", requirePermission("fulfilment.record"), (req, res) => {
  const app = get<{ id: string; status: string; region_id: string; district_id: string }>("SELECT id, status, region_id, district_id FROM applications WHERE id = ?", [req.params.id]);
  if (!app) return res.status(404).json({ error: "Application not found" });
  if (!canAccessGeo(req.auth!, app.region_id, app.district_id)) return res.status(403).json({ error: "Outside your geographic scope" });
  if (!["disbursement", "partially_fulfilled"].includes(app.status)) {
    return res.status(400).json({ error: "This application is not in the disbursement phase" });
  }
  const b = req.body || {};
  if (!b.itemDescription) return res.status(400).json({ error: "Item description is required" });
  const decision = get<{ id: string }>("SELECT id FROM decisions WHERE application_id = ? AND outcome = 'approved' ORDER BY created_at DESC LIMIT 1", [app.id]);
  run(
    `INSERT INTO fulfilments (id, application_id, decision_id, officer_user_id, item_description, quantity, notes, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [newId("ful"), app.id, decision?.id || null, req.auth!.id, b.itemDescription, Number(b.quantity || 1), b.notes || null, now()],
  );
  const complete = Boolean(b.complete);
  const next = complete ? "completed" : "partially_fulfilled";
  if (app.status !== next) changeStatus({ applicationId: app.id, to: next, actor: req.auth!, note: b.notes || "Fulfilment recorded" });
  audit({ actorUserId: req.auth!.id, action: "application.fulfil", entityType: "application", entityId: app.id });
  res.json(loadApplication(app.id));
});

applicationRouter.post("/:id/documents", requirePermission("documents.upload"), upload.single("file"), (req, res) => {
  const app = get<{ id: string; region_id: string; district_id: string; applicant_profile_id: string; category_code: string }>(
    "SELECT id, region_id, district_id, applicant_profile_id, category_code FROM applications WHERE id = ?",
    [req.params.id],
  );
  if (!app) return res.status(404).json({ error: "Application not found" });
  try {
    assertAppAccess(req.auth!, app, true);
  } catch (e) {
    return res.status((e as { status?: number }).status || 403).json({ error: (e as Error).message });
  }
  if (!req.file) return res.status(400).json({ error: "A file is required" });
  const docType = String(req.body.documentType || "supporting");
  const isMedical = docType.includes("medical") || app.category_code === "health" ? 1 : 0;
  const id = newId("doc");
  run(
    `INSERT INTO documents (id, application_id, applicant_profile_id, document_type, original_name, stored_path, mime_type, size_bytes, is_medical, verification_status, uploaded_by_user_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?, 'pending', ?, ?)`,
    [id, app.id, app.applicant_profile_id, docType, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size, isMedical, req.auth!.id, now()],
  );
  audit({ actorUserId: req.auth!.id, action: "document.upload", entityType: "document", entityId: id, metadata: { documentType: docType, isMedical } });
  res.status(201).json({ id, documentType: docType, originalName: req.file.originalname });
});

applicationRouter.get("/documents/:docId/file", requirePermission("documents.read", "profile.self.read"), (req, res) => {
  const doc = get<{ stored_path: string; original_name: string; mime_type: string; is_medical: number; application_id: string }>(
    "SELECT stored_path, original_name, mime_type, is_medical, application_id FROM documents WHERE id = ?",
    [req.params.docId],
  );
  if (!doc) return res.status(404).json({ error: "Document not found" });
  if (doc.is_medical && !req.auth!.permissions.includes("documents.read_medical") && !req.auth!.roles.includes("applicant")) {
    return res.status(403).json({ error: "Medical documents require additional permission" });
  }
  const filePath = path.join(uploadRoot, doc.stored_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing" });
  audit({ actorUserId: req.auth!.id, action: "document.download", entityType: "document", entityId: req.params.docId });
  const mime = doc.mime_type || "application/octet-stream";
  res.setHeader("Content-Type", mime);
  const safeName = (doc.original_name || "document").replace(/[^\w.\- ()]/g, "_");
  if (mime.includes("pdf") || mime.startsWith("image/")) {
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  }
  res.sendFile(filePath);
});

function validateForSubmit(app: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const personId = String(app.person_id || "");
  const card = get("SELECT id FROM person_identifiers WHERE person_id = ? AND id_type = 'ghana_card'", [personId]);
  if (!card) errors.push("Ghana Card is required before the application can proceed");
  const documents = (app.documents || []) as { document_type?: string }[];
  const docPhoto = documents.some((doc) => doc.document_type === "passport_photo" || doc.document_type === "passport_picture");
  const categoryCode = String(app.category_code || "");
  const profileId = String(app.applicant_profile_id || "");
  let hasPhoto = docPhoto;
  if (categoryCode === "caregivers") {
    const cg = get<{ photo_path: string | null }>(
      `SELECT p.photo_path FROM caregiver_relationships cr
       JOIN persons p ON p.id = cr.caregiver_person_id
       WHERE cr.applicant_profile_id = ? AND cr.status = 'active' LIMIT 1`,
      [profileId],
    );
    hasPhoto = hasPhoto || Boolean(cg?.photo_path);
  } else {
    const person = get<{ photo_path: string | null }>("SELECT photo_path FROM persons WHERE id = ?", [personId]);
    hasPhoto = hasPhoto || Boolean(person?.photo_path);
  }
  if (!hasPhoto) errors.push("A passport photograph is required before the application can proceed");
  return errors;
}
