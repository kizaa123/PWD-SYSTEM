import type { RegistrationSupportIntake } from "../lib/registrationIntake";
import { registrationIntakeRequestRows } from "../lib/registrationIntakeDisplay";

type Props = {
  intake: RegistrationSupportIntake;
  /** Shorter helper for compact surfaces (e.g. modal). */
  compact?: boolean;
  className?: string;
};

export function RegistrationIntakeSummary({ intake, compact = false, className = "" }: Props) {
  const rows = registrationIntakeRequestRows(intake);
  if (rows.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-teal/25 bg-teal/[0.04] p-5 shadow-sm ${className}`}
    >
      <div>
        <h4 className="text-sm font-bold text-navy">Support from registration</h4>
        {!compact && (
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-muted">
            Selected at registration. Complete the amount and signature below.
          </p>
        )}
      </div>
      <dl className="mt-4 grid gap-x-10 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <dt className="text-xs font-medium leading-snug text-muted">{row.label}</dt>
            <dd className="mt-1 text-sm font-semibold leading-snug text-navy">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
