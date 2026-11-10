import { useEffect, useMemo, useState } from "react";
import { Button } from "./StatusBadge";
import { CATEGORY_LABELS } from "../lib/api";
import { SupportTypePrintSheet } from "./SupportTypePrintSheet";
import { SupportTypeDotSummary } from "./SupportTypeDotSummary";

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

type Props = {
  groups: SupportTypeCategoryGroup[];
  yearLabel: string;
  variant?: "dashboard" | "reports";
  /** When set, shows Print all lists (support types + names only). */
  printMeta?: { scopeLabel: string; generatedAt: string };
};

function ChevronDown({ open, className = "" }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""} ${className}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PeopleTable({ people, caption }: { people: SupportTypePerson[]; caption?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-canvas bg-canvas/50">
      {caption ? (
        <p className="border-b border-canvas bg-white px-3 py-2 text-xs font-semibold text-navy">{caption}</p>
      ) : null}
      <table className="data-table w-full text-left text-xs sm:text-sm">
        <thead className="bg-white text-muted">
          <tr>
            <th>Name</th>
            <th>Reg. no.</th>
            <th>App. ref.</th>
            <th className="hidden sm:table-cell">Phone</th>
            <th className="hidden md:table-cell">Community</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={`${p.application_reference}-${p.applicant_ref}`} className="border-t border-canvas bg-white">
              <td>
                <span className="font-semibold text-navy">{p.display_name}</span>
                {p.registration_type === "caregiver" && p.beneficiary_name ? (
                  <span className="mt-0.5 block text-[11px] font-normal text-muted">
                    PWD: {p.beneficiary_name}
                  </span>
                ) : null}
              </td>
              <td className="font-mono text-[11px] sm:text-xs">{p.applicant_ref}</td>
              <td className="font-mono text-[11px] sm:text-xs">{p.application_reference}</td>
              <td className="hidden sm:table-cell">{p.phone || "—"}</td>
              <td className="hidden md:table-cell">{p.community || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SupportTypeBreakdownPanel({ groups, yearLabel, variant = "reports", printMeta }: Props) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());
  const [openRoster, setOpenRoster] = useState<string | null>(null);

  useEffect(() => {
    setOpenCategories(new Set());
    setOpenRoster(null);
  }, [groups, yearLabel]);

  function toggleCategory(code: string) {
    const closing = openCategories.has(code);
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
    if (closing) {
      setOpenRoster((r) => {
        if (!r) return null;
        const cat = groups.find((g) => g.category_code === code);
        if (cat?.lines.some((l) => l.segment_key === r)) return null;
        return r;
      });
    }
  }

  const totalApplicants = useMemo(
    () => new Set(groups.flatMap((g) => g.lines.flatMap((l) => l.people.map((p) => p.applicant_ref)))).size,
    [groups],
  );

  const showPrint = Boolean(printMeta && groups.length > 0);

  if (!groups.length) {
    return (
      <section className="rounded-2xl bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-navy">Support types by need</h2>
        <p className="mt-2 text-sm text-muted">No support applications for {yearLabel} in your scope yet.</p>
      </section>
    );
  }

  return (
    <>
      {showPrint && printMeta ? (
        <SupportTypePrintSheet
          groups={groups}
          yearLabel={yearLabel}
          scopeLabel={printMeta.scopeLabel}
          generatedAt={printMeta.generatedAt}
          documentTitle="Support types and applicant lists"
        />
      ) : null}

      <section className="no-print rounded-2xl bg-surface shadow-sm">
        <div className="flex flex-col gap-3 border-b border-canvas px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-navy">Support types by need</h2>
            <p className="mt-0.5 text-xs text-muted">
              Year <span className="font-semibold text-navy">{yearLabel}</span> ·{" "}
              <span className="font-semibold text-navy">{totalApplicants}</span> qualified applicant
              {totalApplicants === 1 ? "" : "s"} · excludes office “not qualified” · use the{" "}
              <span className="font-semibold text-navy">arrow</span> to open a category, then a support type for names
            </p>
          </div>
          {showPrint ? (
            <Button type="button" tone="ghost" className="shrink-0" onClick={() => window.print()}>
              Print all lists
            </Button>
          ) : null}
        </div>

        <div className="space-y-3 px-4 py-5 sm:px-5">
          {groups.map((group) => {
            const title = CATEGORY_LABELS[group.category_code] || group.category_name;
            const categoryOpen = openCategories.has(group.category_code);
            return (
              <div key={group.category_code} className="overflow-hidden rounded-xl border border-slate-200">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 bg-canvas px-4 py-3 text-left transition hover:bg-slate-100"
                  onClick={() => toggleCategory(group.category_code)}
                  aria-expanded={categoryOpen}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ChevronDown open={categoryOpen} className="text-teal" />
                    <span className="text-sm font-semibold text-navy">{title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    <span className="font-bold tabular-nums text-navy">{group.applicants}</span> applicant
                    {group.applicants === 1 ? "" : "s"}
                  </span>
                </button>
                {categoryOpen ? (
                  <div className="border-t border-slate-200 bg-white">
                    <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-navy">
                      {title} — {group.applicants} applicant{group.applicants === 1 ? "" : "s"}
                    </p>
                    <SupportTypeDotSummary
                      lines={group.lines}
                      activeSegmentKey={
                        group.lines.some((l) => l.segment_key === openRoster) ? openRoster : null
                      }
                      onLineClick={(segmentKey) => {
                        setOpenRoster(openRoster === segmentKey ? null : segmentKey);
                      }}
                    />
                    {(() => {
                      const line = group.lines.find((l) => l.segment_key === openRoster);
                      if (!line?.people.length) return null;
                      return (
                        <div className="border-t border-canvas bg-canvas/20 px-4 py-4">
                          <PeopleTable people={line.people} caption={line.label} />
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
