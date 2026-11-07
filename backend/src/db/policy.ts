import type { DatabaseSync } from "node:sqlite";
import { DEMO_PASSWORD } from "../lib/constants.ts";
import { hashPassword, newId } from "../lib/crypto.ts";

export const COVERAGE_DISTRICT_CODE = "KEEA";
export const COVERAGE_DISTRICT_NAME = "Komenda Edina Eguafo Abrem Municipal Assembly";
export const COVERAGE_REGION_CODE = "CR";

const CATEGORY_DOCUMENTS: Record<string, { mandatory: string[]; supplementary: string[] }> = {
  education: { mandatory: ["passport_photo", "ghana_card"], supplementary: ["admission_letter", "school_invoice"] },
  health: { mandatory: ["passport_photo", "ghana_card"], supplementary: ["medical_receipt"] },
  income_generating: { mandatory: ["passport_photo", "ghana_card"], supplementary: [] },
  caregivers: { mandatory: ["passport_photo", "ghana_card"], supplementary: ["caregiver_ghana_card", "pwd_nhis"] },
  assistive_device: { mandatory: ["passport_photo", "ghana_card"], supplementary: ["prescription"] },
};

const COMMITTEE_PERMISSIONS = [
  "auth.login",
  "applications.read",
  "documents.read",
  "documents.read_medical",
  "decision.approve",
  "reports.district",
];

function migrateApplicationWorkflow(db: DatabaseSync) {
  const appCols = db.prepare("PRAGMA table_info(applications)").all() as { name: string }[];
  if (!appCols.some((c) => c.name === "application_year")) {
    db.exec("ALTER TABLE applications ADD COLUMN application_year INTEGER");
  }
  if (!appCols.some((c) => c.name === "applicant_signature_label")) {
    db.exec("ALTER TABLE applications ADD COLUMN applicant_signature_label TEXT");
  }
  if (!appCols.some((c) => c.name === "endorsing_officer_name")) {
    db.exec("ALTER TABLE applications ADD COLUMN endorsing_officer_name TEXT");
  }
  if (!appCols.some((c) => c.name === "endorsed_at")) {
    db.exec("ALTER TABLE applications ADD COLUMN endorsed_at TEXT");
  }
  if (!appCols.some((c) => c.name === "office_use_qualified")) {
    db.exec("ALTER TABLE applications ADD COLUMN office_use_qualified TEXT");
  }
  if (!appCols.some((c) => c.name === "office_use_remarks")) {
    db.exec("ALTER TABLE applications ADD COLUMN office_use_remarks TEXT");
  }
  const healthCols = db.prepare("PRAGMA table_info(health_details)").all() as { name: string }[];
  if (!healthCols.some((c) => c.name === "assistive_device_key")) {
    db.exec("ALTER TABLE health_details ADD COLUMN assistive_device_key TEXT");
  }
  const profileCols = db.prepare("PRAGMA table_info(applicant_profiles)").all() as { name: string }[];
  if (!profileCols.some((c) => c.name === "registration_type")) {
    db.exec("ALTER TABLE applicant_profiles ADD COLUMN registration_type TEXT NOT NULL DEFAULT 'pwd'");
  }
  if (!profileCols.some((c) => c.name === "registration_support_intake")) {
    db.exec("ALTER TABLE applicant_profiles ADD COLUMN registration_support_intake TEXT");
  }
  if (!profileCols.some((c) => c.name === "client_registration_id")) {
    db.exec("ALTER TABLE applicant_profiles ADD COLUMN client_registration_id TEXT");
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_applicant_client_reg ON applicant_profiles(client_registration_id) WHERE client_registration_id IS NOT NULL",
    );
  }
  const caregiverRelCols = db.prepare("PRAGMA table_info(caregiver_relationships)").all() as { name: string }[];
  if (!caregiverRelCols.some((c) => c.name === "community_name")) {
    db.exec("ALTER TABLE caregiver_relationships ADD COLUMN community_name TEXT");
  }
  const userCols = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!userCols.some((c) => c.name === "last_seen_at")) {
    db.exec("ALTER TABLE users ADD COLUMN last_seen_at TEXT");
  }
  db.prepare(
    "UPDATE applications SET application_year = COALESCE(application_year, CAST(strftime('%Y', created_at) AS INTEGER))",
  ).run();
  const map: Record<string, string> = {
    draft: "registration",
    submitted: "registration",
    under_verification: "interview",
    under_assessment: "interview",
    pending_decision: "selection",
    escalated: "selection",
    approved: "selection",
    pending_fulfilment: "disbursement",
    partially_fulfilled: "partially_fulfilled",
    fulfilled: "completed",
  };
  for (const [from, to] of Object.entries(map)) {
    db.prepare("UPDATE applications SET status = ? WHERE status = ?").run(to, from);
  }
}

/** Apply the current operating rules to a new or already-seeded database. */
function migrateDemoStaffEmails(db: DatabaseSync) {
  db.prepare("UPDATE users SET email = ? WHERE email = ?").run(DEMO_WELFARE_EMAIL, "register@accra.gh");
  db.prepare("UPDATE users SET email = ? WHERE email = ?").run(DEMO_ADMIN_EMAIL, "admin@ncpd.gov.gh");
}

function refreshDemoStaffPasswords(db: DatabaseSync) {
  const hash = hashPassword(DEMO_PASSWORD);
  for (const email of CORE_STAFF_EMAILS) {
    db.prepare("UPDATE users SET password_hash = ?, status = 'active', failed_logins = 0, locked_until = NULL WHERE email = ?").run(
      hash,
      email,
    );
  }
}

export function applyOperatingPolicy(db: DatabaseSync) {
  migrateApplicationWorkflow(db);
  migrateDemoStaffEmails(db);
  const now = new Date().toISOString();
  const regionId = ensureCentralRegion(db);
  const districtId = ensureKeea(db, regionId);
  db.prepare("UPDATE districts SET is_active = 0 WHERE code != ?").run(COVERAGE_DISTRICT_CODE);
  db.prepare("UPDATE districts SET is_active = 1, name = ? WHERE id = ?").run(COVERAGE_DISTRICT_NAME, districtId);

  db.prepare(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ('coverage', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).run(
    JSON.stringify({
      districtCode: COVERAGE_DISTRICT_CODE,
      districtName: COVERAGE_DISTRICT_NAME,
      regionCode: COVERAGE_REGION_CODE,
      note: "Pilot coverage: Central Region municipal assembly (internal scope).",
    }),
    now,
  );

  db.prepare("UPDATE applicant_profiles SET district_id = ?, region_id = ?").run(districtId, regionId);
  db.prepare("UPDATE applications SET district_id = ?, region_id = ?").run(districtId, regionId);
  db.prepare("UPDATE user_scopes SET district_id = ?, region_id = ? WHERE scope_level = 'district'").run(districtId, regionId);
  db.prepare("UPDATE user_scopes SET region_id = ?, district_id = NULL WHERE scope_level = 'region'").run(regionId);

  for (const name of ["Elmina", "Komenda", "Eguafo", "Abrem"]) {
    const existing = db.prepare("SELECT id FROM communities WHERE district_id = ? AND name = ?").get(districtId, name) as { id: string } | undefined;
    if (!existing) db.prepare("INSERT INTO communities (id, district_id, name) VALUES (?,?,?)").run(newId("com"), districtId, name);
  }

  for (const [code, docs] of Object.entries(CATEGORY_DOCUMENTS)) {
    db.prepare("UPDATE support_categories SET required_documents = ? WHERE code = ?").run(JSON.stringify(docs), code);
  }

  const committeeRoleId = ensureRole(
    db,
    "fund_committee",
    "Disability Fund Management Committee",
    "Final approval authority for the Disability Fund",
  );
  ensureRole(db, "registration_officer", "Social Welfare Officer", "Registers persons with disability and opens yearly support requests");
  ensureRole(db, "district_officer", "District Officer", "District case monitoring. Final approval sits with the Disability Fund Management Committee.");
  syncPhaseRolePermissions(db);

  const approvePerm = db.prepare("SELECT id FROM permissions WHERE code = 'decision.approve'").get() as { id: string } | undefined;
  const districtRole = db.prepare("SELECT id FROM roles WHERE code = 'district_officer'").get() as { id: string } | undefined;
  if (approvePerm && districtRole) {
    db.prepare("DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?").run(districtRole.id, approvePerm.id);
  }
  for (const code of COMMITTEE_PERMISSIONS) {
    const perm = db.prepare("SELECT id FROM permissions WHERE code = ?").get(code) as { id: string } | undefined;
    if (!perm) continue;
    db.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)").run(committeeRoleId, perm.id);
  }

  retainOnlyCoreStaffAccounts(db);
  refreshDemoStaffPasswords(db);
  alignRegistrationOfficerScope(db, districtId, regionId);
  db.prepare("UPDATE applicant_profiles SET registered_by_user_id = NULL WHERE registration_source = 'self'").run();
  const registrationOfficer = db.prepare("SELECT id FROM users WHERE email = 'welfare@demo.gh' LIMIT 1").get() as { id: string } | undefined;
  if (registrationOfficer) {
    db.prepare(
      "UPDATE applicant_profiles SET registered_by_user_id = ? WHERE registration_source = 'staff' AND registered_by_user_id IS NULL",
    ).run(registrationOfficer.id);
  }

  keepOneCaregiver(db);
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS one_active_caregiver_per_applicant ON caregiver_relationships(applicant_profile_id) WHERE status = 'active'",
  );
}

function ensureCentralRegion(db: DatabaseSync) {
  const existing = db.prepare("SELECT id FROM regions WHERE code = ?").get(COVERAGE_REGION_CODE) as { id: string } | undefined;
  if (existing) return existing.id;
  const id = newId("reg");
  db.prepare("INSERT INTO regions (id, code, name, is_active) VALUES (?,?, 'Central', 1)").run(id, COVERAGE_REGION_CODE);
  return id;
}

function ensureKeea(db: DatabaseSync, regionId: string) {
  const existing = db.prepare("SELECT id FROM districts WHERE code = ?").get(COVERAGE_DISTRICT_CODE) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE districts SET region_id = ?, name = ?, is_active = 1 WHERE id = ?").run(regionId, COVERAGE_DISTRICT_NAME, existing.id);
    return existing.id;
  }
  const id = newId("dst");
  db.prepare("INSERT INTO districts (id, region_id, code, name, is_active) VALUES (?,?,?,?,1)").run(id, regionId, COVERAGE_DISTRICT_CODE, COVERAGE_DISTRICT_NAME);
  return id;
}

/** Each workflow role only gets permissions for its phase (enforced in UI + API visibility). */
function syncPhaseRolePermissions(db: DatabaseSync) {
  const sets: Record<string, string[]> = {
    registration_officer: [
      "auth.login",
      "applicants.create",
      "applicants.read",
      "applicants.update",
      "applications.create",
      "applications.read",
      "applications.submit",
      "documents.upload",
      "documents.read",
      "reports.district",
    ],
    verification_officer: ["auth.login", "applications.read", "documents.read", "documents.read_medical", "verification.perform", "reports.district"],
    assessment_officer: [
      "auth.login",
      "applications.read",
      "documents.read",
      "documents.read_medical",
      "verification.perform",
      "assessment.perform",
      "reports.district",
    ],
    fund_committee: [
      "auth.login",
      "applications.read",
      "documents.read",
      "documents.read_medical",
      "decision.approve",
      "reports.district",
    ],
    finance_officer: ["auth.login", "applications.read", "fulfilment.record", "documents.read", "reports.district"],
  };
  for (const [roleCode, permCodes] of Object.entries(sets)) {
    const role = db.prepare("SELECT id FROM roles WHERE code = ?").get(roleCode) as { id: string } | undefined;
    if (!role) continue;
    db.prepare("DELETE FROM role_permissions WHERE role_id = ?").run(role.id);
    for (const code of permCodes) {
      const perm = db.prepare("SELECT id FROM permissions WHERE code = ?").get(code) as { id: string } | undefined;
      if (perm) db.prepare("INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)").run(role.id, perm.id);
    }
  }
}

function ensureRole(db: DatabaseSync, code: string, name: string, description: string) {
  const existing = db.prepare("SELECT id FROM roles WHERE code = ?").get(code) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE roles SET name = ?, description = ? WHERE id = ?").run(name, description, existing.id);
    return existing.id;
  }
  const id = newId("role");
  db.prepare("INSERT INTO roles (id, code, name, description) VALUES (?,?,?,?)").run(id, code, name, description);
  return id;
}

export const DEMO_WELFARE_EMAIL = "welfare@demo.gh";
export const DEMO_ADMIN_EMAIL = "admin@demo.gh";
const CORE_STAFF_EMAILS = [DEMO_WELFARE_EMAIL, DEMO_ADMIN_EMAIL];

/** Suspend demo / extra seeded staff logins; only registration + system admin stay active. */
function retainOnlyCoreStaffAccounts(db: DatabaseSync) {
  const placeholders = CORE_STAFF_EMAILS.map(() => "?").join(", ");
  db.prepare(`UPDATE users SET status = 'suspended' WHERE email NOT IN (${placeholders})`).run(...CORE_STAFF_EMAILS);
  db.prepare(`UPDATE users SET status = 'active' WHERE email IN (${placeholders})`).run(...CORE_STAFF_EMAILS);
}

function alignRegistrationOfficerScope(db: DatabaseSync, districtId: string, regionId: string) {
  const row = db.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").get(DEMO_WELFARE_EMAIL) as { id: string } | undefined;
  if (!row) return;
  const scope = db.prepare("SELECT id FROM user_scopes WHERE user_id = ? LIMIT 1").get(row.id) as { id: string } | undefined;
  if (scope) {
    db.prepare("UPDATE user_scopes SET scope_level = 'district', district_id = ?, region_id = ? WHERE id = ?").run(
      districtId,
      regionId,
      scope.id,
    );
  } else {
    db.prepare("INSERT INTO user_scopes (id, user_id, scope_level, region_id, district_id) VALUES (?,?, 'district', ?, ?)").run(
      newId("scp"),
      row.id,
      regionId,
      districtId,
    );
  }
}

function keepOneCaregiver(db: DatabaseSync) {
  const rows = db.prepare(
    "SELECT id, applicant_profile_id, created_at FROM caregiver_relationships WHERE status = 'active' ORDER BY created_at ASC, id ASC",
  ).all() as { id: string; applicant_profile_id: string; created_at: string }[];
  const seen = new Set<string>();
  const update = db.prepare("UPDATE caregiver_relationships SET status = 'inactive' WHERE id = ?");
  for (const row of rows) {
    if (seen.has(row.applicant_profile_id)) update.run(row.id);
    else seen.add(row.applicant_profile_id);
  }
}
