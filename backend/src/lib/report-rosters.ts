import { all } from "../db/index.ts";
import type { AuthUser } from "../lib/auth.ts";
import { geoFilterSql } from "../lib/auth.ts";

const YEAR_APP_EXCLUDE = "('cancelled', 'rejected', 'registration')";

export type ReportPersonRow = {
  applicant_ref: string;
  display_name: string;
  beneficiary_name: string | null;
  registration_type: string;
  phone: string | null;
  community: string | null;
  disability_category: string | null;
  district_name: string;
  region_name: string;
  registered_at: string;
  registration_year: number;
};

export type ReportAppliedRow = ReportPersonRow & {
  application_reference: string;
  application_year: number;
  category_name: string;
  amount_requested_pesewas: number | null;
  status: string;
  applied_at: string;
};

type RawPerson = Record<string, unknown>;

function mapPersonRow(row: RawPerson): ReportPersonRow {
  const isCaregiver = row.registration_type === "caregiver";
  const caregiverName = String(row.caregiver_full_name || "").trim();
  const beneficiaryName = String(row.beneficiary_name || "").trim();
  const phone = isCaregiver
    ? String(row.caregiver_phone || row.beneficiary_phone || "").trim()
    : String(row.beneficiary_phone || "").trim();
  const community = isCaregiver
    ? String(row.caregiver_community || row.community_name || "").trim()
    : String(row.community_name || "").trim();
  const created = String(row.created_at || "");
  const regYear = Number(row.registration_year) || (created ? new Date(created).getFullYear() : 0);
  return {
    applicant_ref: String(row.applicant_ref),
    display_name: isCaregiver && caregiverName ? caregiverName : beneficiaryName || "—",
    beneficiary_name: beneficiaryName || null,
    registration_type: isCaregiver ? "caregiver" : "pwd",
    phone: phone || null,
    community: community || null,
    disability_category: String(row.disability_category || "").trim() || null,
    district_name: String(row.district_name),
    region_name: String(row.region_name),
    registered_at: created,
    registration_year: regYear,
  };
}

const PERSON_SELECT = `
  ap.applicant_ref, ap.registration_type, ap.disability_category, ap.community_name,
  ap.created_at, CAST(strftime('%Y', ap.created_at) AS INTEGER) AS registration_year,
  d.name AS district_name, r.name AS region_name,
  p.full_name AS beneficiary_name, p.phone AS beneficiary_phone,
  cg_p.full_name AS caregiver_full_name, cg_p.phone AS caregiver_phone,
  cg_cr.community_name AS caregiver_community
`;

const PERSON_JOINS = `
  FROM applicant_profiles ap
  JOIN persons p ON p.id = ap.person_id
  JOIN regions r ON r.id = ap.region_id
  JOIN districts d ON d.id = ap.district_id
  LEFT JOIN caregiver_relationships cg_cr ON cg_cr.applicant_profile_id = ap.id AND cg_cr.status = 'active'
  LEFT JOIN persons cg_p ON cg_p.id = cg_cr.caregiver_person_id
`;

export function loadReportRosters(user: AuthUser, year: number | null): {
  registeredPeople: ReportPersonRow[];
  appliedPeople: ReportAppliedRow[];
  notAppliedPeople: ReportPersonRow[];
} {
  const geoAp = geoFilterSql(user, "ap.region_id", "ap.district_id");
  const geoApp = geoFilterSql(user);

  const regYearSql = year != null ? " AND strftime('%Y', ap.created_at) = ?" : "";
  const regParams = year != null ? [...geoAp.params, String(year)] : [...geoAp.params];

  const registeredPeople = all<RawPerson>(
    `SELECT ${PERSON_SELECT}
     ${PERSON_JOINS}
     WHERE ${geoAp.sql}${regYearSql}
     ORDER BY ap.created_at DESC
     LIMIT 5000`,
    regParams,
  ).map(mapPersonRow);

  const notAppliedSql =
    year != null
      ? `SELECT ${PERSON_SELECT}
         ${PERSON_JOINS}
         WHERE ${geoAp.sql} AND strftime('%Y', ap.created_at) = ?
         AND NOT EXISTS (
           SELECT 1 FROM applications ax
           WHERE ax.applicant_profile_id = ap.id
             AND ax.application_year = ?
             AND ax.status NOT IN ${YEAR_APP_EXCLUDE}
         )
         ORDER BY ap.created_at DESC
         LIMIT 5000`
      : `SELECT ${PERSON_SELECT}
         ${PERSON_JOINS}
         WHERE ${geoAp.sql}
         AND NOT EXISTS (
           SELECT 1 FROM applications ax
           WHERE ax.applicant_profile_id = ap.id
             AND ax.status NOT IN ${YEAR_APP_EXCLUDE}
         )
         ORDER BY ap.created_at DESC
         LIMIT 5000`;

  const notAppliedParams =
    year != null ? [...geoAp.params, String(year), year] : [...geoAp.params];

  const notAppliedPeople = all<RawPerson>(notAppliedSql, notAppliedParams).map(mapPersonRow);

  const appYearSql = year != null ? " AND a.application_year = ?" : "";
  const appParams = year != null ? [...geoApp.params, year] : [...geoApp.params];

  const appliedRaw = all<RawPerson & Record<string, unknown>>(
    `SELECT ${PERSON_SELECT},
            a.reference AS application_reference, a.application_year, a.amount_requested_pesewas,
            a.status, a.created_at AS applied_at, sc.name AS category_name
     FROM applications a
     JOIN applicant_profiles ap ON ap.id = a.applicant_profile_id
     JOIN persons p ON p.id = ap.person_id
     JOIN regions r ON r.id = ap.region_id
     JOIN districts d ON d.id = ap.district_id
     LEFT JOIN caregiver_relationships cg_cr ON cg_cr.applicant_profile_id = ap.id AND cg_cr.status = 'active'
     LEFT JOIN persons cg_p ON cg_p.id = cg_cr.caregiver_person_id
     JOIN support_categories sc ON sc.code = a.category_code
     WHERE ${geoApp.sql} AND a.status NOT IN ${YEAR_APP_EXCLUDE}${appYearSql}
     ORDER BY a.application_year DESC, a.created_at DESC
     LIMIT 5000`,
    appParams,
  );

  const appliedPeople: ReportAppliedRow[] = appliedRaw.map((row) => ({
    ...mapPersonRow(row),
    application_reference: String(row.application_reference),
    application_year: Number(row.application_year),
    category_name: String(row.category_name),
    amount_requested_pesewas:
      row.amount_requested_pesewas != null ? Number(row.amount_requested_pesewas) : null,
    status: String(row.status),
    applied_at: String(row.applied_at),
  }));

  return { registeredPeople, appliedPeople, notAppliedPeople };
}
