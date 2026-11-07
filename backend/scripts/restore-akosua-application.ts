import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applicationReference, newId } from "../src/lib/crypto.ts";

const dbPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data/pwd.sqlite");
const db = new DatabaseSync(dbPath);
const year = new Date().getFullYear();
const now = new Date().toISOString();

const profile = db
  .prepare(
    `SELECT ap.id, ap.region_id, ap.district_id, p.full_name
     FROM applicant_profiles ap
     JOIN persons p ON p.id = ap.person_id
     WHERE p.full_name = ?`,
  )
  .get("Akosua Sarpong") as { id: string; region_id: string; district_id: string; full_name: string } | undefined;

if (!profile) {
  console.error("Akosua Sarpong profile not found.");
  process.exit(1);
}

const existing = db
  .prepare(
    "SELECT id FROM applications WHERE applicant_profile_id = ? AND application_year = ? LIMIT 1",
  )
  .get(profile.id, year);

if (existing) {
  console.log("Akosua already has a", year, "application.");
  process.exit(0);
}

const creator = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get("welfare@demo.gh") as { id: string } | undefined;

const appId = newId("app");
const reference = applicationReference();

db.prepare(
  `INSERT INTO applications (
     id, reference, applicant_profile_id, category_code, region_id, district_id, status,
     application_year, amount_requested_pesewas, amount_approved_pesewas, currency,
     purpose_summary, submitted_at, created_by_user_id, created_at, updated_at
   ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
).run(
  appId,
  reference,
  profile.id,
  "education",
  profile.region_id,
  profile.district_id,
  "registration",
  year,
  180000,
  null,
  "GHS",
  "Secondary school fees — Tamale Girls SHS",
  now,
  creator?.id ?? null,
  now,
  now,
);

db.prepare(
  `INSERT INTO application_events (id, application_id, from_status, to_status, actor_user_id, note, created_at)
   VALUES (?,?,?,?,?,?,?)`,
).run(newId("evt"), appId, null, "registration", creator?.id ?? null, "Restored demonstration case", now);

db.prepare(
  `INSERT INTO education_details (
     application_id, education_mode, education_level, enrolment_status, apprenticeship_type,
     support_type, school_name, school_type, qualification_pursued, school_account_name,
     school_account_number, school_bank_name, school_branch
   ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
).run(
  appId,
  "Formal",
  "Secondary",
  "Continuing",
  null,
  "School fees",
  "Tamale Girls SHS",
  "Public Secondary",
  null,
  null,
  null,
  null,
  null,
);

console.log("Restored application", reference, "for", profile.full_name);
