import { all } from "../db/index.ts";
import type { AuthUser } from "./auth.ts";
import { geoFilterSql } from "./auth.ts";
import { currentApplicationYear, sqlApplicationIncludedInSupportTypeBreakdown } from "./applications-core.ts";
import { ACTIVE_SUPPORT_CATEGORY_CODES } from "./constants.ts";

export type SupportTypePerson = {
  applicant_ref: string;
  display_name: string;
  beneficiary_name: string | null;
  registration_type: string;
  phone: string | null;
  community: string | null;
  application_reference: string;
  application_year: number;
  segment_label: string;
};

export type SupportTypeLine = {
  segment_key: string;
  label: string;
  applicants: number;
  applications: number;
  people: SupportTypePerson[];
};

export type SupportTypeCategoryGroup = {
  category_code: string;
  category_name: string;
  applicants: number;
  applications: number;
  lines: SupportTypeLine[];
};

const CATEGORY_ORDER = ACTIVE_SUPPORT_CATEGORY_CODES;

function yearAppWhere(user: AuthUser, year: number | null) {
  const geo = geoFilterSql(user);
  const qualify = sqlApplicationIncludedInSupportTypeBreakdown("a");
  if (year == null) {
    return {
      sql: `${geo.sql} AND ${qualify}`,
      params: [...geo.params] as string[],
    };
  }
  return {
    sql: `${geo.sql} AND a.application_year = ? AND ${qualify}`,
    params: [...geo.params, String(year)] as string[],
  };
}

function displayName(row: {
  registration_type: string;
  caregiver_full_name: string | null;
  beneficiary_name: string;
}): string {
  const isCaregiver = row.registration_type === "caregiver";
  const caregiver = (row.caregiver_full_name || "").trim();
  const beneficiary = (row.beneficiary_name || "").trim();
  return isCaregiver && caregiver ? caregiver : beneficiary || "—";
}

function phoneForRow(row: {
  registration_type: string;
  caregiver_phone: string | null;
  beneficiary_phone: string | null;
}): string | null {
  const isCaregiver = row.registration_type === "caregiver";
  const v = isCaregiver
    ? (row.caregiver_phone || row.beneficiary_phone || "").trim()
    : (row.beneficiary_phone || "").trim();
  return v || null;
}

function communityForRow(row: {
  registration_type: string;
  caregiver_community: string | null;
  community_name: string | null;
}): string | null {
  const isCaregiver = row.registration_type === "caregiver";
  const v = isCaregiver
    ? (row.caregiver_community || row.community_name || "").trim()
    : (row.community_name || "").trim();
  return v || null;
}

function educationSegment(row: Record<string, unknown>): string {
  const mode = String(row.ed_education_mode || "").trim();
  const apprenticeship = String(row.ed_apprenticeship_type || "").trim();
  if (mode === "Informal" || apprenticeship) {
    return `Apprenticeship — ${apprenticeship || "Unspecified"}`;
  }
  const support = String(row.ed_support_type || "").trim();
  if (!support) return "Education (unspecified)";
  if (support.toLowerCase().includes("technical")) {
    const device =
      String(row.ed_device_type || "").trim() ||
      String(row.ed_device_key || "").trim() ||
      String(row.ed_device_other || "").trim();
    return device ? `Technical aid (${device})` : "Technical aid";
  }
  return support;
}

function healthSegment(row: Record<string, unknown>): string {
  const purpose = String(row.hd_health_purpose || "").trim();
  const lower = purpose.toLowerCase();
  if (lower.includes("medication")) return "Medication";
  if (lower.includes("therapy")) return "Therapy";
  if (lower.includes("surgery")) return "Surgery";
  if (lower.includes("assistive") || row.hd_assistive_device_type || row.hd_assistive_device_key) {
    const device =
      String(row.hd_assistive_device_type || "").trim() ||
      String(row.hd_assistive_device_key || "").trim();
    return device ? `Assistive device (${device})` : "Assistive device";
  }
  if (purpose) return purpose;
  const summary = String(row.purpose_summary || "").trim();
  if (summary) {
    const parts = summary.split("—").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts[parts.length - 1];
  }
  return "Health (unspecified)";
}

function incomeSegment(row: Record<string, unknown>): string {
  const subtype = String(row.iad_subtype || "").trim();
  if (subtype === "startup_tool") {
    const item =
      String(row.iad_item_specification || "").trim() ||
      String(row.iad_device_type || "").trim() ||
      String(row.iad_device_key || "").trim();
    return item ? `Start-up tool (${item})` : "Start-up tool";
  }
  if (subtype === "startup_capital") {
    const item = String(row.iad_item_specification || "").trim();
    return item ? `Start-up capital (${item})` : "Start-up capital";
  }
  const activity = String(row.iad_business_activity || "").trim();
  return activity ? `Income generating — ${activity}` : "Income generating (unspecified)";
}

function segmentLabel(category: string, row: Record<string, unknown>): string {
  switch (category) {
    case "education":
      return educationSegment(row);
    case "health":
      return healthSegment(row);
    case "income_generating":
      return incomeSegment(row);
    default: {
      const summary = String(row.purpose_summary || "").trim();
      const cat = String(row.category_name || category || "Support");
      if (summary) {
        const parts = summary.split("—").map((p) => p.trim()).filter(Boolean);
        if (parts.length > 1) return parts.slice(1).join(" — ");
        return summary;
      }
      return `${cat} (unspecified)`;
    }
  }
}

function segmentKey(category: string, label: string): string {
  return `${category}::${label.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

type AppRow = Record<string, unknown>;

export function loadSupportTypeBreakdown(user: AuthUser, year: number | null): SupportTypeCategoryGroup[] {
  const where = yearAppWhere(user, year);
  const rows = all<AppRow>(
    `SELECT a.id, a.reference, a.application_year, a.category_code, a.purpose_summary, a.applicant_profile_id,
            sc.name AS category_name,
            ap.applicant_ref, ap.registration_type, ap.community_name, ap.disability_category,
            p.full_name AS beneficiary_name, p.phone AS beneficiary_phone,
            cg_p.full_name AS caregiver_full_name, cg_p.phone AS caregiver_phone,
            cg_cr.community_name AS caregiver_community,
            ed.education_mode AS ed_education_mode, ed.apprenticeship_type AS ed_apprenticeship_type,
            ed.support_type AS ed_support_type, ed.device_type AS ed_device_type, ed.device_key AS ed_device_key,
            ed.device_other AS ed_device_other,
            hd.health_purpose AS hd_health_purpose, hd.assistive_device_type AS hd_assistive_device_type,
            hd.assistive_device_key AS hd_assistive_device_key,
            iad.subtype AS iad_subtype, iad.business_activity AS iad_business_activity,
            iad.item_specification AS iad_item_specification, iad.device_type AS iad_device_type,
            iad.device_key AS iad_device_key
     FROM applications a
     JOIN support_categories sc ON sc.code = a.category_code
     JOIN applicant_profiles ap ON ap.id = a.applicant_profile_id
     JOIN persons p ON p.id = ap.person_id
     LEFT JOIN caregiver_relationships cg_cr ON cg_cr.applicant_profile_id = ap.id AND cg_cr.status = 'active'
     LEFT JOIN persons cg_p ON cg_p.id = cg_cr.caregiver_person_id
     LEFT JOIN education_details ed ON ed.application_id = a.id
     LEFT JOIN health_details hd ON hd.application_id = a.id
     LEFT JOIN income_activity_details iad ON iad.application_id = a.id
     WHERE ${where.sql}
       AND a.category_code IN (${ACTIVE_SUPPORT_CATEGORY_CODES.map(() => "?").join(",")})
     ORDER BY a.category_code, a.created_at DESC`,
    [...where.params, ...ACTIVE_SUPPORT_CATEGORY_CODES],
  );

  const byCategory = new Map<
    string,
    {
      category_name: string;
      lineMap: Map<string, { label: string; applicantIds: Set<string>; applications: number; people: SupportTypePerson[] }>;
    }
  >();

  for (const row of rows) {
    const category = String(row.category_code || "");
    if (!category) continue;
    const categoryName = String(row.category_name || category);
    const label = segmentLabel(category, row);
    const key = segmentKey(category, label);

    if (!byCategory.has(category)) {
      byCategory.set(category, { category_name: categoryName, lineMap: new Map() });
    }
    const bucket = byCategory.get(category)!;
    if (!bucket.lineMap.has(key)) {
      bucket.lineMap.set(key, { label, applicantIds: new Set(), applications: 0, people: [] });
    }
    const line = bucket.lineMap.get(key)!;
    const profileId = String(row.applicant_profile_id || "");
    line.applicantIds.add(profileId);
    line.applications += 1;
    line.people.push({
      applicant_ref: String(row.applicant_ref || ""),
      display_name: displayName({
        registration_type: String(row.registration_type || ""),
        caregiver_full_name: (row.caregiver_full_name as string) ?? null,
        beneficiary_name: String(row.beneficiary_name || ""),
      }),
      beneficiary_name: String(row.beneficiary_name || "").trim() || null,
      registration_type: row.registration_type === "caregiver" ? "caregiver" : "pwd",
      phone: phoneForRow({
        registration_type: String(row.registration_type || ""),
        caregiver_phone: (row.caregiver_phone as string) ?? null,
        beneficiary_phone: (row.beneficiary_phone as string) ?? null,
      }),
      community: communityForRow({
        registration_type: String(row.registration_type || ""),
        caregiver_community: (row.caregiver_community as string) ?? null,
        community_name: (row.community_name as string) ?? null,
      }),
      application_reference: String(row.reference || ""),
      application_year: Number(row.application_year) || currentApplicationYear(),
      segment_label: label,
    });
  }

  const groups: SupportTypeCategoryGroup[] = [];
  const ordered = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c as (typeof CATEGORY_ORDER)[number])).sort(),
  ];

  for (const category_code of ordered) {
    const bucket = byCategory.get(category_code)!;
    const lines: SupportTypeLine[] = [...bucket.lineMap.entries()]
      .map(([segment_key, v]) => ({
        segment_key,
        label: v.label,
        applicants: v.applicantIds.size,
        applications: v.applications,
        people: v.people,
      }))
      .sort((a, b) => b.applicants - a.applicants || a.label.localeCompare(b.label));

    const catApplicantIds = new Set<string>();
    let applications = 0;
    for (const line of lines) {
      applications += line.applications;
      for (const p of line.people) {
        catApplicantIds.add(p.applicant_ref);
      }
    }

    groups.push({
      category_code,
      category_name: bucket.category_name,
      applicants: catApplicantIds.size,
      applications,
      lines,
    });
  }

  return groups;
}
