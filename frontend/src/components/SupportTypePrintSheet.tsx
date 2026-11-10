import { createPortal } from "react-dom";
import type { SupportTypeCategoryGroup } from "./SupportTypeBreakdownPanel";
import { SupportTypePrintSections } from "./SupportTypePrintSections";

type Props = {
  groups: SupportTypeCategoryGroup[];
  yearLabel: string;
  scopeLabel?: string;
  generatedAt: string;
  documentTitle?: string;
};

export function SupportTypePrintSheet({
  groups,
  yearLabel,
  scopeLabel,
  generatedAt,
  documentTitle = "Support type lists",
}: Props) {
  const totalApplicants = new Set(
    groups.flatMap((g) => g.lines.flatMap((l) => l.people.map((p) => p.applicant_ref))),
  ).size;

  const sheet = (
    <div className="support-type-print-sheet" aria-hidden>
      <header className="reports-print-header">
        <p className="reports-print-org">National Council on Persons with Disability</p>
        <p className="reports-print-org-sub">DACF support register</p>
        <h1 className="reports-print-title">{documentTitle}</h1>
        <p className="reports-print-meta">
          Support year <strong>{yearLabel}</strong>
          {scopeLabel ? ` · ${scopeLabel}` : ""} · Generated {generatedAt} · {totalApplicants} distinct applicant
          {totalApplicants === 1 ? "" : "s"} · excludes office not qualified
        </p>
      </header>
      {groups.length === 0 ? (
        <p className="reports-print-muted">No support applications in this period.</p>
      ) : (
        <SupportTypePrintSections groups={groups} />
      )}
    </div>
  );

  return createPortal(sheet, document.body);
}
