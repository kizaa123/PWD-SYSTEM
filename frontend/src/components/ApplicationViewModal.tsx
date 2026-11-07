import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { buildApplicationPrintSnapshot } from "../lib/applicationPrint";
import { ApplicationPrintSheet } from "./ApplicationPrintSheet";
import { ApplicationRecordView, type RecordApplicant, type RecordApplication } from "./ApplicationRecordView";
import {
  PASSPORT_PHOTO_BOX_PRIMARY,
  PASSPORT_PHOTO_PRIMARY_CLASS,
  RegisteredPassportPhoto,
} from "./RegisteredPassportPhoto";
import { Button } from "./StatusBadge";

type Lookups = { disabilities: string[] };

type Props = {
  applicationId: string;
  onClose: () => void;
};

export function ApplicationViewModal({ applicationId, onClose }: Props) {
  const [application, setApplication] = useState<RecordApplication | null>(null);
  const [applicant, setApplicant] = useState<RecordApplicant | null>(null);
  const [disabilities, setDisabilities] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      api<RecordApplication & { applicant_profile_id: string }>(`/api/applications/${applicationId}`),
      api<Lookups>("/api/auth/lookups").catch(() => ({ disabilities: [] as string[] })),
    ])
      .then(async ([app, lookups]) => {
        const person = await api<RecordApplicant>(`/api/applicants/${app.applicant_profile_id}`);
        if (cancelled) return;
        setApplication(app);
        setApplicant(person);
        setDisabilities(lookups.disabilities ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message || "Could not load this application.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  const printSnapshot = useMemo(() => {
    if (!applicant || !application) return null;
    return buildApplicationPrintSnapshot(applicant, application, disabilities);
  }, [applicant, application, disabilities]);

  const isCaregiverReg = applicant?.registration_type === "caregiver";

  return (
    <>
      {printSnapshot ? <ApplicationPrintSheet snapshot={printSnapshot} /> : null}
    <div className="no-print fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-xs sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-record-title"
        className="relative flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-canvas shadow-2xl sm:max-h-[92vh] sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal">Application record</p>
            <h2 id="application-record-title" className="truncate text-lg font-bold text-navy">
              {loading ? "Loading application…" : application?.reference || "Application"}
            </h2>
          </div>
          {!loading && applicant && (
            <RegisteredPassportPhoto
              applicantProfileId={applicant.id}
              subject={isCaregiverReg ? "caregiver" : "beneficiary"}
              photoPath={isCaregiverReg ? applicant.caregiver_photo_path : applicant.photo_path}
              size="small"
              align="end"
              showLabel={false}
              className={`shrink-0 ${PASSPORT_PHOTO_PRIMARY_CLASS}`}
              boxMaxWidthClass={PASSPORT_PHOTO_BOX_PRIMARY}
            />
          )}
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {!error && applicant && application && (
            <ApplicationRecordView
              applicant={applicant}
              application={application}
              disabilities={disabilities}
              hideInlinePassportPhotos
            />
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          {applicant && application && !loading && (
            <Button type="button" tone="ghost" onClick={() => window.print()}>
              Print application
            </Button>
          )}
          <Button type="button" tone="ghost" onClick={onClose}>
            Close
          </Button>
        </footer>
      </div>
    </div>
    </>
  );
}
