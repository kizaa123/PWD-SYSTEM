import type { DatabaseSync } from "node:sqlite";
import { hashPassword, newId } from "../lib/crypto.ts";
import { DEMO_PASSWORD } from "../lib/constants.ts";

type DB = DatabaseSync;

function insert(db: DB, table: string, row: Record<string, string | number | null>) {
  const keys = Object.keys(row);
  const sql = `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`;
  db.prepare(sql).run(...keys.map((k) => row[k]));
}

export function seedIfEmpty(db: DB) {
  const existing = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
  if (existing.c > 0) return;

  const now = new Date().toISOString();
  const passwordHash = hashPassword(DEMO_PASSWORD);

  const regions: { id: string; code: string; name: string }[] = [
    ["GAR", "Greater Accra"],
    ["ASH", "Ashanti"],
    ["WR", "Western"],
    ["WNR", "Western North"],
    ["CR", "Central"],
    ["ER", "Eastern"],
    ["VR", "Volta"],
    ["OR", "Oti"],
    ["NR", "Northern"],
    ["SR", "Savannah"],
    ["NER", "North East"],
    ["UER", "Upper East"],
    ["UWR", "Upper West"],
    ["BR", "Bono"],
    ["BER", "Bono East"],
    ["AR", "Ahafo"],
  ].map(([code, name]) => ({ id: newId("reg"), code, name }));

  for (const r of regions) insert(db, "regions", { ...r, is_active: 1 });

  const regionByCode = Object.fromEntries(regions.map((r) => [r.code, r]));

  const districtDefs: [string, string, string][] = [
    ["GAR", "AMA", "Accra Metropolitan"],
    ["GAR", "TMA", "Tema Metropolitan"],
    ["GAR", "GAE", "Ga East"],
    ["GAR", "GAW", "Ga West"],
    ["GAR", "ASHM", "Ashaiman"],
    ["GAR", "LEDZ", "Ledzokuku"],
    ["ASH", "KMA", "Kumasi Metropolitan"],
    ["ASH", "OBU", "Obuasi Municipal"],
    ["ASH", "ASOK", "Asokwa"],
    ["ASH", "OFOR", "Oforikrom"],
    ["NR", "TMA2", "Tamale Metropolitan"],
    ["NR", "SAG", "Sagnarigu"],
    ["ER", "NJS", "New Juaben South"],
    ["CR", "KEEA", "Komenda Edina Eguafo Abrem Municipal Assembly"],
    ["CR", "CCM", "Cape Coast Metropolitan"],
    ["WR", "STMA", "Sekondi-Takoradi Metropolitan"],
    ["UER", "BOL", "Bolgatanga Municipal"],
    ["UWR", "WA", "Wa Municipal"],
    ["VR", "HO", "Ho Municipal"],
    ["BR", "SUN", "Sunyani Municipal"],
    ["BER", "TECH", "Techiman Municipal"],
    ["AR", "ASU", "Asunafo North"],
    ["WNR", "SEF", "Sefwi Wiawso"],
    ["OR", "KRE", "Krachi East"],
    ["SR", "WGO", "West Gonja"],
    ["NER", "EMA", "East Mamprusi"],
  ];

  const districts = districtDefs.map(([rc, code, name]) => ({
    id: newId("dst"),
    region_id: regionByCode[rc].id,
    code,
    name,
    is_active: code === "KEEA" ? 1 : 0,
  }));
  for (const d of districts) insert(db, "districts", d);
  const districtByCode = Object.fromEntries(districts.map((d) => [d.code, d]));

  insert(db, "communities", { id: newId("com"), district_id: districtByCode.AMA.id, name: "Osu" });
  insert(db, "communities", { id: newId("com"), district_id: districtByCode.AMA.id, name: "Madina" });
  insert(db, "communities", { id: newId("com"), district_id: districtByCode.KMA.id, name: "Asafo" });
  insert(db, "communities", { id: newId("com"), district_id: districtByCode.TMA2.id, name: "Lamashegu" });

  const roles = [
    ["applicant", "Applicant / PWD", "Self-service applicant"],
    ["caregiver", "Caregiver", "Linked caregiver with limited access"],
    ["registration_officer", "Social Welfare Officer", "Registers PWDs and yearly support requests"],
    ["verification_officer", "Verification Officer", "Document and identity review"],
    ["assessment_officer", "Assessment Officer", "Eligibility and needs assessment"],
    ["district_officer", "District Officer", "District case monitoring. Final approval sits with the Disability Fund Management Committee."],
    ["fund_committee", "Disability Fund Management Committee", "Final approval authority for the Disability Fund"],
    ["finance_officer", "Finance / Fulfilment Officer", "Record disbursement and delivery"],
    ["district_supervisor", "District Supervisor", "District monitoring"],
    ["regional_officer", "Regional Officer", "Regional monitoring and escalation"],
    ["national_admin", "National Administrator", "National configuration and reporting"],
    ["system_admin", "System Administrator", "Technical administration"],
    ["auditor", "Auditor", "Read-only audit access"],
  ].map(([code, name, description]) => ({ id: newId("role"), code, name, description }));
  for (const r of roles) insert(db, "roles", r);
  const roleByCode = Object.fromEntries(roles.map((r) => [r.code, r]));

  const permissionCodes = [
    "auth.login",
    "profile.self.read",
    "profile.self.write",
    "applicants.create",
    "applicants.read",
    "applicants.update",
    "applications.create",
    "applications.read",
    "applications.submit",
    "documents.upload",
    "documents.read",
    "documents.read_medical",
    "verification.perform",
    "assessment.perform",
    "decision.approve",
    "decision.escalate",
    "fulfilment.record",
    "reports.district",
    "reports.region",
    "reports.national",
    "users.manage",
    "settings.manage",
    "audit.read",
    "export.reports",
  ];
  const permissions = permissionCodes.map((code) => ({ id: newId("perm"), code, name: code }));
  for (const p of permissions) insert(db, "permissions", p);
  const permByCode = Object.fromEntries(permissions.map((p) => [p.code, p]));

  const rolePerms: Record<string, string[]> = {
    applicant: ["auth.login", "profile.self.read", "profile.self.write", "applications.create", "applications.read", "applications.submit", "documents.upload", "documents.read"],
    caregiver: ["auth.login", "profile.self.read", "applications.read", "documents.upload"],
    registration_officer: ["auth.login", "applicants.create", "applicants.read", "applicants.update", "applications.create", "applications.read", "applications.submit", "documents.upload", "documents.read", "reports.district"],
    verification_officer: ["auth.login", "applications.read", "documents.read", "documents.read_medical", "verification.perform", "reports.district"],
    assessment_officer: ["auth.login", "applications.read", "documents.read", "documents.read_medical", "verification.perform", "assessment.perform", "reports.district"],
    district_officer: ["auth.login", "applicants.read", "applications.read", "documents.read", "documents.read_medical", "decision.escalate", "reports.district"],
    fund_committee: ["auth.login", "applicants.read", "applications.read", "documents.read", "documents.read_medical", "decision.approve", "reports.district"],
    finance_officer: ["auth.login", "applications.read", "fulfilment.record", "documents.read", "reports.district"],
    district_supervisor: ["auth.login", "applicants.read", "applications.read", "reports.district", "audit.read"],
    regional_officer: ["auth.login", "applicants.read", "applications.read", "decision.escalate", "reports.district", "reports.region", "audit.read"],
    national_admin: ["auth.login", "applicants.read", "applications.read", "reports.district", "reports.region", "reports.national", "users.manage", "settings.manage", "audit.read", "export.reports"],
    system_admin: ["auth.login", "users.manage", "settings.manage", "audit.read"],
    auditor: ["auth.login", "applicants.read", "applications.read", "documents.read", "reports.district", "reports.region", "reports.national", "audit.read", "export.reports"],
  };
  for (const [role, perms] of Object.entries(rolePerms)) {
    for (const code of perms) {
      db.prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)").run(roleByCode[role].id, permByCode[code].id);
    }
  }

  const categories = [
    { code: "education", name: "Educational Support", description: "School fees, bursary, technical aid and apprenticeship", sort: 1, docs: ["passport_photo", "ghana_card", "admission_letter", "school_invoice"] },
    { code: "health", name: "Health Support", description: "Medication, surgery, therapy and related medical support", sort: 2, docs: ["passport_photo", "ghana_card", "medical_receipt"] },
    { code: "income_generating", name: "Income Generating Activities", description: "Start-up capital or start-up tools", sort: 3, docs: ["passport_photo", "ghana_card"] },
    { code: "caregivers", name: "Caregivers Support", description: "Support for caregivers of persons with disability", sort: 4, docs: ["passport_photo", "ghana_card", "caregiver_ghana_card"] },
    { code: "assistive_device", name: "Assistive Device", description: "Official DACF form category — wheelchair, hearing aid, braille and related devices", sort: 5, docs: ["passport_photo", "ghana_card", "prescription"] },
  ];
  for (const c of categories) {
    insert(db, "support_categories", {
      id: newId("cat"),
      code: c.code,
      name: c.name,
      description: c.description,
      parent_code: null,
      required_documents: JSON.stringify(c.docs),
      is_active: 1,
      sort_order: c.sort,
    });
  }

  insert(db, "system_settings", {
    key: "approval_limit_pesewas",
    value: JSON.stringify({ district_officer: 1000000, escalate_above: 1000000 }),
    updated_at: now,
  });
  insert(db, "system_settings", {
    key: "duplicate_rules",
    value: JSON.stringify({ block_open_same_category: true, flag_same_ghana_card: true }),
    updated_at: now,
  });

  function person(name: string, sex: string, phone: string, extra: Partial<Record<string, string | number | null>> = {}) {
    const id = newId("per");
    insert(db, "persons", {
      id,
      full_name: name,
      date_of_birth: (extra.date_of_birth as string) || "1990-01-15",
      age: (extra.age as number) || 36,
      sex,
      phone,
      email: (extra.email as string) || null,
      home_address: (extra.home_address as string) || "Accra",
      photo_path: null,
      created_at: now,
      updated_at: now,
    });
    return id;
  }

  function user(email: string, personId: string | null, role: string, scope: { level: "district" | "region" | "national"; district?: string; region?: string }) {
    const id = newId("usr");
    insert(db, "users", {
      id,
      email,
      password_hash: passwordHash,
      person_id: personId,
      status: "active",
      must_change_password: 0,
      failed_logins: 0,
      locked_until: null,
      last_login_at: null,
      created_at: now,
    });
    db.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)").run(id, roleByCode[role].id);
    insert(db, "user_scopes", {
      id: newId("scp"),
      user_id: id,
      scope_level: scope.level,
      region_id: scope.region ? regionByCode[scope.region].id : scope.district ? districtByCode[scope.district].region_id : null,
      district_id: scope.district ? districtByCode[scope.district].id : null,
    });
    return id;
  }

  user("register@accra.gh", person("Efua Registration", "female", "0201111000"), "registration_officer", {
    level: "district",
    district: "KEEA",
  });
  user("admin@ncpd.gov.gh", person("System Administrator", "male", "0302000002"), "system_admin", { level: "national" });

  db.prepare(
    "INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, outcome, metadata, ip_address, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(newId("aud"), null, "system.seed", "database", "pwd.sqlite", "success", JSON.stringify({ message: "Initial national seed completed" }), null, now);
}
