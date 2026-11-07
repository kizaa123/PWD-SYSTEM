import { CATEGORY_LABELS, pesewasToGhs, STATUS_LABELS } from "./api";
import { formatAppDateFromIso, formatAppDateTimeFromIso } from "./dateFormat";
import type { YearCategorySlice, YearSupportBar } from "../components/DashboardYearCharts";

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

export type YearStatsExport = {
  year: number;
  yearFilterAll?: boolean;
  registered: number;
  applied: number;
  notApplied: number;
  totalRequestedPesewas: number;
  byCategory: YearCategorySlice[];
  supportBreakdown: YearSupportBar[];
};

function csvCell(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

function formatRegDate(iso: string): string {
  return formatAppDateFromIso(iso) || "—";
}

function personDetailRows(p: ReportPersonRow): (string | number)[] {
  return [
    p.applicant_ref,
    p.display_name,
    p.beneficiary_name && p.registration_type === "caregiver" ? p.beneficiary_name : "",
    p.registration_type === "caregiver" ? "Caregiver" : "PWD",
    p.phone ?? "",
    p.community ?? "",
    p.disability_category ?? "",
    p.district_name,
    p.region_name,
    formatRegDate(p.registered_at),
    p.registration_year,
  ];
}

const PERSON_HEADERS = [
  "Applicant no.",
  "Name",
  "Beneficiary (if caregiver)",
  "Type",
  "Phone",
  "Community",
  "Disability",
  "District",
  "Region",
  "Registered",
  "Reg. year",
];

export function downloadYearReportCsv(
  stats: YearStatsExport,
  generatedAt: string,
  opts: {
    filterLabel: string;
    registeredPeople: ReportPersonRow[];
    appliedPeople: ReportAppliedRow[];
    notAppliedPeople: ReportPersonRow[];
  },
) {
  const lines: string[] = [];
  const fileYear = opts.filterLabel.replace(/\s+/g, "-").toLowerCase();

  lines.push(csvRow(["PWD Care Fund — Year report", opts.filterLabel]));
  lines.push(csvRow(["Generated", generatedAt]));
  lines.push("");
  lines.push(csvRow(["Summary metric", "Value"]));
  lines.push(csvRow(["Registered", stats.registered]));
  lines.push(csvRow(["Applied", stats.applied]));
  lines.push(csvRow(["Not applied", stats.notApplied]));
  lines.push(csvRow(["Total amount requested", pesewasToGhs(stats.totalRequestedPesewas)]));
  lines.push("");
  lines.push(csvRow(["Category", "Applicants", "Requested"]));
  for (const c of stats.byCategory) {
    const label = CATEGORY_LABELS[c.category_code] || c.category_name || c.category_code;
    lines.push(csvRow([label, c.applicants, pesewasToGhs(c.requested_pesewas)]));
  }
  lines.push("");
  lines.push(csvRow(["Purpose", "Applications", "Requested"]));
  for (const b of stats.supportBreakdown) {
    lines.push(csvRow([b.label, b.applications, pesewasToGhs(b.requested_pesewas)]));
  }

  lines.push("");
  lines.push(csvRow([`Registered people (${opts.filterLabel})`]));
  lines.push(csvRow(PERSON_HEADERS));
  for (const p of opts.registeredPeople) {
    lines.push(csvRow(personDetailRows(p)));
  }

  lines.push("");
  lines.push(csvRow([`Applied (${opts.filterLabel})`]));
  lines.push(
    csvRow([
      ...PERSON_HEADERS,
      "Application ref.",
      "Support year",
      "Category",
      "Requested (GHS)",
      "Status",
      "Applied",
    ]),
  );
  for (const p of opts.appliedPeople) {
    lines.push(
      csvRow([
        ...personDetailRows(p),
        p.application_reference,
        p.application_year,
        p.category_name,
        p.amount_requested_pesewas != null ? pesewasToGhs(p.amount_requested_pesewas) : "",
        STATUS_LABELS[p.status] || p.status,
        formatAppDateTimeFromIso(p.applied_at) || "—",
      ]),
    );
  }

  lines.push("");
  lines.push(csvRow([`Registered, not applied (${opts.filterLabel})`]));
  lines.push(csvRow(PERSON_HEADERS));
  for (const p of opts.notAppliedPeople) {
    lines.push(csvRow(personDetailRows(p)));
  }

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pwd-year-report-${fileYear}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
