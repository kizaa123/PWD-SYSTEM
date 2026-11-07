import { all, get } from "../db/index.ts";
import type { AuthUser } from "../lib/auth.ts";
import { geoFilterSql } from "../lib/auth.ts";
import {
  currentApplicationYear,
  sqlApplicationIsSubstantive,
  sqlProfileHasAppliedForSupportYear,
  sqlProfileHasSubstantiveApplicationAnyYear,
} from "../lib/applications-core.ts";

export type YearCategorySlice = {
  category_code: string;
  category_name: string;
  applicants: number;
  requested_pesewas: number;
};

export type YearSupportBar = {
  label: string;
  requested_pesewas: number;
  applications: number;
};

export type YearDashboardStats = {
  year: number;
  yearFilterAll?: boolean;
  registered: number;
  applied: number;
  notApplied: number;
  totalRequestedPesewas: number;
  byCategory: YearCategorySlice[];
  supportBreakdown: YearSupportBar[];
};

function yearAppWhere(user: AuthUser, year: number) {
  const geo = geoFilterSql(user);
  return {
    sql: `${geo.sql} AND a.application_year = ? AND ${sqlApplicationIsSubstantive("a")}`,
    params: [...geo.params, year],
  };
}

function yearAppWhereBroad(user: AuthUser, year: number) {
  const geo = geoFilterSql(user);
  return {
    sql: `${geo.sql} AND a.application_year = ? AND a.status NOT IN ('cancelled', 'rejected')`,
    params: [...geo.params, year],
  };
}

export function loadAvailableReportYears(user: AuthUser): number[] {
  const geo = geoFilterSql(user);
  const geoAp = geoFilterSql(user, "ap.region_id", "ap.district_id");
  const fromApps = all<{ y: number }>(
    `SELECT DISTINCT a.application_year AS y FROM applications a WHERE ${geo.sql}`,
    geo.params,
  ).map((r) => r.y);
  const fromProfiles = all<{ y: number }>(
    `SELECT DISTINCT CAST(strftime('%Y', ap.created_at) AS INTEGER) AS y
     FROM applicant_profiles ap WHERE ${geoAp.sql} AND ap.created_at IS NOT NULL`,
    geoAp.params,
  ).map((r) => r.y);
  const set = new Set<number>([...fromApps, ...fromProfiles, currentApplicationYear()]);
  return [...set].filter((y) => Number.isFinite(y) && y > 2000).sort((a, b) => b - a);
}

export function loadYearDashboardStats(user: AuthUser, year: number | null = currentApplicationYear()): YearDashboardStats {
  const geoAp = geoFilterSql(user, "ap.region_id", "ap.district_id");
  const allYears = year == null;
  const statsYear = year ?? currentApplicationYear();
  const yearStr = year != null ? String(year) : "";

  const registered = allYears
    ? (get<{ c: number }>(`SELECT COUNT(*) AS c FROM applicant_profiles ap WHERE ${geoAp.sql}`, [...geoAp.params])?.c ?? 0)
    : (get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM applicant_profiles ap WHERE ${geoAp.sql} AND strftime('%Y', ap.created_at) = ?`,
        [...geoAp.params, yearStr],
      )?.c ?? 0);

  const geoApp = geoFilterSql(user);
  const appliedWhere = allYears
    ? { sql: `${geoApp.sql} AND ${sqlApplicationIsSubstantive("a")}`, params: [...geoApp.params] }
    : yearAppWhere(user, year as number);

  const applied =
    get<{ c: number }>(
      `SELECT COUNT(DISTINCT a.applicant_profile_id) AS c FROM applications a WHERE ${appliedWhere.sql}`,
      appliedWhere.params,
    )?.c ?? 0;

  const notAppliedClause = allYears
    ? sqlProfileHasSubstantiveApplicationAnyYear("ap.id", false)
    : sqlProfileHasAppliedForSupportYear(year as number, "ap.id", false).sql;

  const notApplied = allYears
    ? (get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM applicant_profiles ap WHERE ${geoAp.sql} AND ${notAppliedClause}`,
        [...geoAp.params],
      )?.c ?? 0)
    : (get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM applicant_profiles ap
         WHERE ${geoAp.sql} AND strftime('%Y', ap.created_at) = ? AND ${notAppliedClause}`,
        [...geoAp.params, yearStr, ...(sqlProfileHasAppliedForSupportYear(year as number, "ap.id", false).params)],
      )?.c ?? 0);

  const broad = allYears
    ? { sql: `${geoApp.sql} AND a.status NOT IN ('cancelled', 'rejected')`, params: [...geoApp.params] }
    : yearAppWhereBroad(user, year as number);
  const totalRequestedPesewas =
    get<{ s: number }>(
      `SELECT COALESCE(SUM(a.amount_requested_pesewas), 0) AS s FROM applications a WHERE ${broad.sql}`,
      broad.params,
    )?.s ?? 0;

  const byCategory = all<{
    category_code: string;
    category_name: string;
    applicants: number;
    requested_pesewas: number;
  }>(
    `SELECT a.category_code, sc.name AS category_name,
            COUNT(DISTINCT a.applicant_profile_id) AS applicants,
            COALESCE(SUM(a.amount_requested_pesewas), 0) AS requested_pesewas
     FROM applications a
     JOIN support_categories sc ON sc.code = a.category_code
     WHERE ${appliedWhere.sql}
     GROUP BY a.category_code
     ORDER BY applicants DESC`,
    appliedWhere.params,
  );

  const educationBars = all<{ label: string; requested_pesewas: number; applications: number }>(
    `SELECT COALESCE(NULLIF(TRIM(ed.support_type), ''), 'Educational support (unspecified)') AS label,
            COALESCE(SUM(a.amount_requested_pesewas), 0) AS requested_pesewas,
            COUNT(*) AS applications
     FROM applications a
     JOIN education_details ed ON ed.application_id = a.id
     WHERE ${appliedWhere.sql} AND a.category_code = 'education'
     GROUP BY label`,
    appliedWhere.params,
  );

  const healthBars = all<{ label: string; requested_pesewas: number; applications: number }>(
    `SELECT COALESCE(
              NULLIF(TRIM(hd.health_purpose), ''),
              NULLIF(TRIM(hd.health_purpose_other), ''),
              NULLIF(TRIM(a.purpose_summary), ''),
              'Health support (unspecified)'
            ) AS label,
            COALESCE(SUM(a.amount_requested_pesewas), 0) AS requested_pesewas,
            COUNT(*) AS applications
     FROM applications a
     JOIN health_details hd ON hd.application_id = a.id
     WHERE ${appliedWhere.sql} AND a.category_code = 'health'
     GROUP BY label`,
    appliedWhere.params,
  );

  const assistiveBars = all<{ label: string; requested_pesewas: number; applications: number }>(
    `SELECT COALESCE(
              NULLIF(TRIM(hd.assistive_device_type), ''),
              NULLIF(TRIM(hd.assistive_device_key), ''),
              'Assistive device (unspecified)'
            ) AS label,
            COALESCE(SUM(a.amount_requested_pesewas), 0) AS requested_pesewas,
            COUNT(*) AS applications
     FROM applications a
     JOIN health_details hd ON hd.application_id = a.id
     WHERE ${appliedWhere.sql} AND a.category_code = 'assistive_device'
     GROUP BY label`,
    appliedWhere.params,
  );

  const incomeBars = all<{ label: string; requested_pesewas: number; applications: number }>(
    `SELECT COALESCE(
              NULLIF(TRIM(iad.business_activity), ''),
              CASE iad.subtype WHEN 'startup_capital' THEN 'Startup capital' WHEN 'startup_tool' THEN 'Startup tools / equipment' ELSE 'Income generating activity' END,
              'Income activity (unspecified)'
            ) AS label,
            COALESCE(SUM(a.amount_requested_pesewas), 0) AS requested_pesewas,
            COUNT(*) AS applications
     FROM applications a
     JOIN income_activity_details iad ON iad.application_id = a.id
     WHERE ${appliedWhere.sql} AND a.category_code = 'income_generating'
     GROUP BY label`,
    appliedWhere.params,
  );

  const caregiverBars = all<{ label: string; requested_pesewas: number; applications: number }>(
    `SELECT COALESCE(
              NULLIF(TRIM(csd.purpose), ''),
              NULLIF(TRIM(csd.purpose_other), ''),
              NULLIF(TRIM(a.purpose_summary), ''),
              'Caregiver support (unspecified)'
            ) AS label,
            COALESCE(SUM(a.amount_requested_pesewas), 0) AS requested_pesewas,
            COUNT(*) AS applications
     FROM applications a
     JOIN caregiver_support_details csd ON csd.application_id = a.id
     WHERE ${appliedWhere.sql} AND a.category_code = 'caregivers'
     GROUP BY label`,
    appliedWhere.params,
  );

  const detailBars = [...educationBars, ...healthBars, ...assistiveBars, ...incomeBars, ...caregiverBars];
  const coveredIds = new Set(
    all<{ id: string }>(
      `SELECT DISTINCT a.id FROM applications a
       LEFT JOIN education_details ed ON ed.application_id = a.id
       LEFT JOIN health_details hd ON hd.application_id = a.id
       LEFT JOIN income_activity_details iad ON iad.application_id = a.id
       LEFT JOIN caregiver_support_details csd ON csd.application_id = a.id
       WHERE ${appliedWhere.sql}
         AND (ed.application_id IS NOT NULL OR hd.application_id IS NOT NULL OR iad.application_id IS NOT NULL OR csd.application_id IS NOT NULL)`,
      appliedWhere.params,
    ).map((r) => r.id),
  );

  const fallbackGrouped = new Map<string, { requested_pesewas: number; applications: number }>();
  const orphanApps = all<{ id: string; label: string; requested_pesewas: number }>(
    `SELECT a.id,
            COALESCE(NULLIF(TRIM(a.purpose_summary), ''), sc.name || ' (purpose not specified)') AS label,
            COALESCE(a.amount_requested_pesewas, 0) AS requested_pesewas
     FROM applications a
     JOIN support_categories sc ON sc.code = a.category_code
     WHERE ${appliedWhere.sql}`,
    appliedWhere.params,
  ).filter((row) => !coveredIds.has(row.id));
  for (const row of orphanApps) {
    const prev = fallbackGrouped.get(row.label) || { requested_pesewas: 0, applications: 0 };
    prev.requested_pesewas += row.requested_pesewas;
    prev.applications += 1;
    fallbackGrouped.set(row.label, prev);
  }
  const mergedFallback = [...fallbackGrouped.entries()].map(([label, v]) => ({
    label,
    requested_pesewas: v.requested_pesewas,
    applications: v.applications,
  }));

  const supportBreakdown = [...detailBars, ...mergedFallback]
    .filter((b) => b.applications > 0)
    .sort((a, b) => b.requested_pesewas - a.requested_pesewas);

  return {
    year: statsYear,
    yearFilterAll: allYears,
    registered,
    applied,
    notApplied,
    totalRequestedPesewas,
    byCategory,
    supportBreakdown,
  };
}
