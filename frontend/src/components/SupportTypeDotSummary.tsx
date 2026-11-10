import type { SupportTypeLine } from "./SupportTypeBreakdownPanel";

type Props = {
  lines: SupportTypeLine[];
  variant?: "screen" | "print";
  activeSegmentKey?: string | null;
  onLineClick?: (segmentKey: string) => void;
};

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
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

/** One summary block per category: type ··· count — roster tables come after this. */
export function SupportTypeDotSummary({ lines, variant = "screen", activeSegmentKey, onLineClick }: Props) {
  const rootClass =
    variant === "print" ? "reports-print-dot-summary support-type-dot-summary" : "support-type-dot-summary px-4 py-3";

  return (
    <div className={rootClass}>
      <div className="support-type-dot-summary-header">
        <span className="support-type-dot-summary-leader">
          <span>Type of support</span>
          <span className="support-type-dot-summary-dots" aria-hidden />
        </span>
        <span className="support-type-dot-summary-head-count">Applicants</span>
      </div>
      {lines.map((line) => {
        const canExpand = line.people.length > 0 && Boolean(onLineClick);
        const open = activeSegmentKey === line.segment_key;
        const rowClass = `support-type-dot-summary-row${open ? " is-open" : ""}${canExpand ? " is-clickable" : ""}`;

        if (canExpand) {
          return (
            <button
              key={line.segment_key}
              type="button"
              className={rowClass}
              onClick={() => onLineClick!(line.segment_key)}
              aria-expanded={open}
            >
              <span className="support-type-dot-summary-leader min-w-0">
                <span className="support-type-dot-summary-label flex min-w-0 items-center gap-1.5">
                  <Chevron open={open} />
                  <span className="min-w-0">{line.label}</span>
                </span>
                <span className="support-type-dot-summary-dots" aria-hidden />
              </span>
              <span className="support-type-dot-summary-count tabular-nums">{line.applicants}</span>
            </button>
          );
        }

        return (
          <div key={line.segment_key} className={rowClass}>
            <span className="support-type-dot-summary-leader">
              <span className="support-type-dot-summary-label">
                <span className="inline-block w-3.5 shrink-0" aria-hidden />
                {line.label}
              </span>
              <span className="support-type-dot-summary-dots" aria-hidden />
            </span>
            <span className="support-type-dot-summary-count tabular-nums">{line.applicants}</span>
          </div>
        );
      })}
    </div>
  );
}
