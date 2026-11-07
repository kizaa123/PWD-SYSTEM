import { useState } from "react";
import { applicationListOutcome } from "../lib/applicantSupportHistory";
import { ApplyForSupportLink } from "./ApplyForSupportLink";
import { ApplicationViewModal } from "./ApplicationViewModal";
import { StatusBadge } from "./StatusBadge";

/** Workflow statuses that display as Registration in the UI. */
const REGISTRATION_PHASE = new Set(["registration", "returned_for_correction", "draft", "submitted"]);

/** Interview-phase requests carry no status of their own in this table. */
const INTERVIEW_PHASE = new Set(["interview", "under_verification", "under_assessment"]);

/** Legacy rows in fulfilment without office-use qualification recorded. */
const FULFILMENT_WITHOUT_QUALIFICATION = new Set([
  "disbursement",
  "pending_fulfilment",
  "partially_fulfilled",
  "completed",
  "fulfilled",
]);

type Row = {
  id: string;
  applicant_profile_id: string;
  status: string;
  applied_current_year?: boolean;
  office_use_qualified?: string | null;
};

const outcomeLinkClass = {
  complete: "text-sm font-bold text-success hover:underline",
  notQualified: "text-sm font-bold text-red-600 hover:underline",
} as const;

export function RegistrationCycleStatus({ row }: { row: Row }) {
  const [viewing, setViewing] = useState(false);

  const outcome = applicationListOutcome(row);
  if (outcome) {
    return (
      <>
        <button
          type="button"
          className={outcomeLinkClass[outcome.tone]}
          onClick={() => setViewing(true)}
        >
          {outcome.label}
        </button>
        {viewing && <ApplicationViewModal applicationId={row.id} onClose={() => setViewing(false)} />}
      </>
    );
  }

  if (INTERVIEW_PHASE.has(row.status)) {
    return <StatusBadge status={row.status} />;
  }

  if (FULFILMENT_WITHOUT_QUALIFICATION.has(row.status)) {
    return (
      <>
        <button type="button" className="text-sm font-bold text-success hover:underline" onClick={() => setViewing(true)}>
          Complete
        </button>
        {viewing && <ApplicationViewModal applicationId={row.id} onClose={() => setViewing(false)} />}
      </>
    );
  }

  if (!REGISTRATION_PHASE.has(row.status)) {
    return <StatusBadge status={row.status} />;
  }

  if (row.applied_current_year) {
    return (
      <>
        <button type="button" className="text-sm font-bold text-navy hover:underline" onClick={() => setViewing(true)}>
          View request
        </button>
        {viewing && <ApplicationViewModal applicationId={row.id} onClose={() => setViewing(false)} />}
      </>
    );
  }

  return <ApplyForSupportLink applicantProfileId={row.applicant_profile_id} />;
}
