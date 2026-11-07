export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS districts (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES regions(id),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS communities (
  id TEXT PRIMARY KEY,
  district_id TEXT NOT NULL REFERENCES districts(id),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  date_of_birth TEXT,
  age INTEGER,
  sex TEXT CHECK (sex IN ('male','female','other','unspecified') OR sex IS NULL),
  phone TEXT,
  email TEXT,
  home_address TEXT,
  photo_path TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  person_id TEXT REFERENCES persons(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','invited')),
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT NOT NULL REFERENCES users(id),
  role_id TEXT NOT NULL REFERENCES roles(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id),
  permission_id TEXT NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

-- Regional-ready geographic assignment: a user may cover one district,
-- many districts, a whole region, or the nation.
CREATE TABLE IF NOT EXISTS user_scopes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope_level TEXT NOT NULL CHECK (scope_level IN ('district','region','national')),
  region_id TEXT REFERENCES regions(id),
  district_id TEXT REFERENCES districts(id)
);

CREATE TABLE IF NOT EXISTS person_identifiers (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  id_type TEXT NOT NULL CHECK (id_type IN ('ghana_card','nhis','other')),
  value_normalized TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'declared'
    CHECK (verification_status IN ('declared','verified','rejected','not_provided')),
  nhis_linked_to_ghana_card INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE (id_type, value_normalized)
);

CREATE TABLE IF NOT EXISTS applicant_profiles (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL UNIQUE REFERENCES persons(id),
  applicant_ref TEXT NOT NULL UNIQUE,
  region_id TEXT NOT NULL REFERENCES regions(id),
  district_id TEXT NOT NULL REFERENCES districts(id),
  community_id TEXT REFERENCES communities(id),
  community_name TEXT,
  occupation TEXT,
  education_level TEXT,
  residence_type TEXT,
  residence_other TEXT,
  disability_category TEXT,
  disability_other TEXT,
  opd_member INTEGER NOT NULL DEFAULT 0,
  opd_name TEXT,
  previous_fund INTEGER NOT NULL DEFAULT 0,
  previous_fund_when TEXT,
  registration_type TEXT NOT NULL DEFAULT 'pwd' CHECK (registration_type IN ('pwd','caregiver')),
  registration_support_intake TEXT,
  registration_source TEXT NOT NULL CHECK (registration_source IN ('self','staff')),
  registered_by_user_id TEXT REFERENCES users(id),
  client_registration_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS caregiver_relationships (
  id TEXT PRIMARY KEY,
  caregiver_person_id TEXT NOT NULL REFERENCES persons(id),
  applicant_profile_id TEXT NOT NULL REFERENCES applicant_profiles(id),
  relationship TEXT NOT NULL,
  relationship_other TEXT,
  hours_of_caregiving TEXT,
  years_of_caregiving TEXT,
  community_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  UNIQUE (caregiver_person_id, applicant_profile_id)
);

CREATE TABLE IF NOT EXISTS support_categories (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  parent_code TEXT,
  required_documents TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  applicant_profile_id TEXT NOT NULL REFERENCES applicant_profiles(id),
  category_code TEXT NOT NULL,
  region_id TEXT NOT NULL REFERENCES regions(id),
  district_id TEXT NOT NULL REFERENCES districts(id),
  status TEXT NOT NULL,
  application_year INTEGER NOT NULL,
  amount_requested_pesewas INTEGER,
  amount_approved_pesewas INTEGER,
  currency TEXT NOT NULL DEFAULT 'GHS',
  purpose_summary TEXT,
  applicant_signature_label TEXT,
  endorsing_officer_name TEXT,
  endorsed_at TEXT,
  office_use_qualified TEXT,
  office_use_remarks TEXT,
  submitted_at TEXT,
  created_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS education_details (
  application_id TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  education_mode TEXT,
  education_level TEXT,
  enrolment_status TEXT,
  apprenticeship_type TEXT,
  support_type TEXT,
  school_name TEXT,
  school_type TEXT,
  qualification_pursued TEXT,
  school_account_name TEXT,
  school_account_number TEXT,
  school_bank_name TEXT,
  school_branch TEXT
);

CREATE TABLE IF NOT EXISTS health_details (
  application_id TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  health_purpose TEXT,
  health_purpose_other TEXT,
  healthcare_provider TEXT,
  nhis_number TEXT,
  nhis_verification_status TEXT NOT NULL DEFAULT 'declared',
  assistive_device_type TEXT,
  assistive_device_key TEXT,
  already_receiving_assistive INTEGER NOT NULL DEFAULT 0,
  existing_assistive_detail TEXT,
  prescribed_where TEXT
);

CREATE TABLE IF NOT EXISTS income_activity_details (
  application_id TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  subtype TEXT NOT NULL CHECK (subtype IN ('startup_capital','startup_tool')),
  business_stage TEXT,
  business_activity TEXT,
  item_specification TEXT
);

CREATE TABLE IF NOT EXISTS caregiver_support_details (
  application_id TEXT PRIMARY KEY REFERENCES applications(id) ON DELETE CASCADE,
  caregiver_person_id TEXT REFERENCES persons(id),
  caregiver_ghana_card TEXT,
  pwd_nhis_number TEXT,
  relationship TEXT,
  relationship_other TEXT,
  hours_of_caregiving TEXT,
  years_of_caregiving TEXT,
  caregiver_education_level TEXT,
  caregiver_residence_type TEXT,
  purpose TEXT,
  purpose_other TEXT
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  application_id TEXT REFERENCES applications(id) ON DELETE CASCADE,
  applicant_profile_id TEXT REFERENCES applicant_profiles(id),
  document_type TEXT NOT NULL,
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  is_medical INTEGER NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  uploaded_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS application_events (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS verifications (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  officer_user_id TEXT NOT NULL REFERENCES users(id),
  identity_ok INTEGER,
  documents_ok INTEGER,
  duplicate_flag INTEGER NOT NULL DEFAULT 0,
  duplicate_note TEXT,
  completeness_ok INTEGER,
  outcome TEXT NOT NULL CHECK (outcome IN ('verified','returned','flagged')),
  comments TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  officer_user_id TEXT NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  findings TEXT,
  recommended_amount_pesewas INTEGER,
  recommended_items TEXT,
  recommendation TEXT NOT NULL CHECK (recommendation IN ('approve','reject','escalate')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  officer_user_id TEXT NOT NULL REFERENCES users(id),
  assessment_id TEXT REFERENCES assessments(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('approved','rejected','returned','escalated')),
  reason TEXT NOT NULL,
  authorized_amount_pesewas INTEGER,
  authorized_items TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS disbursements (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  decision_id TEXT REFERENCES decisions(id),
  officer_user_id TEXT NOT NULL REFERENCES users(id),
  amount_pesewas INTEGER NOT NULL,
  channel TEXT,
  recipient_name TEXT,
  recipient_account TEXT,
  reference_no TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fulfilments (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  decision_id TEXT REFERENCES decisions(id),
  officer_user_id TEXT NOT NULL REFERENCES users(id),
  item_description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  application_id TEXT REFERENCES applications(id),
  channel TEXT NOT NULL DEFAULT 'in_app',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'success',
  metadata TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_districts_region ON districts(region_id);
CREATE INDEX IF NOT EXISTS idx_applicants_district ON applicant_profiles(district_id);
CREATE INDEX IF NOT EXISTS idx_applicants_region ON applicant_profiles(region_id);
CREATE INDEX IF NOT EXISTS idx_apps_district_status ON applications(district_id, status);
CREATE INDEX IF NOT EXISTS idx_apps_region_status ON applications(region_id, status);
CREATE INDEX IF NOT EXISTS idx_apps_category ON applications(category_code, status);
CREATE INDEX IF NOT EXISTS idx_apps_applicant ON applications(applicant_profile_id);
CREATE INDEX IF NOT EXISTS idx_identifiers_person ON person_identifiers(person_id);
CREATE INDEX IF NOT EXISTS idx_scopes_user ON user_scopes(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_app ON application_events(application_id, created_at);
CREATE INDEX IF NOT EXISTS idx_docs_app ON documents(application_id);
`;
