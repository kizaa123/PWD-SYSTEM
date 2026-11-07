import { Link } from "react-router-dom";
import { STATUS_LABELS, STATUS_TONES, statusKind } from "../lib/api";

/** Shared styling for applicant / application reference numbers. */
export const referenceNumberClass = "font-semibold text-info";

export function ReferenceNumber({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`${referenceNumberClass} font-mono ${className || "text-xs"}`.trim()}>{children}</span>
  );
}

export function ReferenceLink({
  to,
  children,
  className = "",
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link to={to} className={`${referenceNumberClass} font-mono text-xs hover:underline ${className}`.trim()}>
      {children}
    </Link>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const kind = statusKind(status);
  const label = STATUS_LABELS[status] || status.replaceAll("_", " ");
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONES[kind]}`}>
      <StatusIcon kind={kind} />
      {label}
    </span>
  );
}

export function StatusIcon({ kind }: { kind: "success" | "warning" | "danger" | "info" | "neutral" }) {
  const common = { width: 12, height: 12, viewBox: "0 0 12 12", fill: "none", "aria-hidden": true as const };
  if (kind === "success") {
    return (
      <svg {...common}>
        <path d="M2.5 6.2l2.2 2.3 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "danger") {
    return (
      <svg {...common}>
        <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "warning") {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 3.8V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="6" cy="8.3" r="0.7" fill="currentColor" />
      </svg>
    );
  }
  if (kind === "info") {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 5.4V8.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="6" cy="3.9" r="0.7" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="6" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function Money({ pesewas, bare = false }: { pesewas?: number | null; bare?: boolean }) {
  if (pesewas == null) return <span className="text-muted">—</span>;
  const amount = (pesewas / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (bare) return <span>{amount}</span>;
  return <span>GHS {amount}</span>;
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-navy">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-sm border border-black/20 bg-surface px-3 py-2 text-sm text-navy shadow-none ring-0 outline-none focus-visible:border-black/35 focus-visible:outline focus-visible:outline-1 focus-visible:outline-teal/50 focus-visible:outline-offset-0";

export function Button({
  children,
  tone = "primary",
  compact = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "ghost" | "danger" | "gold";
  compact?: boolean;
}) {
  const tones = {
    primary: "bg-navy text-white hover:bg-navy/90",
    ghost: "bg-surface text-navy border border-navy/15 hover:bg-canvas",
    danger: "bg-danger text-white hover:bg-danger/90",
    gold: "bg-teal text-white hover:bg-teal/90",
  };
  const sizeClass = compact
    ? "px-3 py-2 text-xs font-semibold whitespace-nowrap sm:px-3.5 sm:text-sm"
    : "px-4 py-2 text-sm font-semibold";
  return (
    <button
      {...props}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg disabled:opacity-50 ${sizeClass} ${tones[tone]} ${props.className || ""}`}
    >
      {children}
    </button>
  );
}
