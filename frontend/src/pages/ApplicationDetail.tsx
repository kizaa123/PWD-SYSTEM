import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatSupportYearWithDateTime, getToken } from "../lib/api";
import { formatAppDateTimeFromIso } from "../lib/dateFormat";
import {
  Button,
  Field,
  Money,
  ReferenceNumber,
  StatusBadge,
  inputClass,
  referenceNumberClass,
} from "../components/StatusBadge";
import { ApplicationWorkflowActions } from "../components/ApplicationWorkflowActions";
import {
  PASSPORT_PHOTO_BOX_PRIMARY,
  PASSPORT_PHOTO_PRIMARY_CLASS,
  RegisteredPassportPhoto,
} from "../components/RegisteredPassportPhoto";
import { useAuth } from "../lib/auth";
import { canRegisterApplicants } from "../lib/workflowAccess";

type App = Record<string, unknown> & {
  id: string;
  reference: string;
  status: string;
  category_code: string;
  category_name: string;
  full_name: string;
  applicant_profile_id: string;
  photo_path?: string | null;
  caregiver_photo_path?: string | null;
  registration_type?: string;
  details: Record<string, unknown> | null;
  documents: { id: string; document_type: string; original_name: string; is_medical: number }[];
  events: { id: string; from_status: string; to_status: string; note: string; created_at: string; actor_email: string }[];
  verifications: Record<string, unknown>[];
  assessments: Record<string, unknown>[];
  decisions: Record<string, unknown>[];
  disbursements: Record<string, unknown>[];
  fulfilments: Record<string, unknown>[];
  duplicates: { type: string; detail: string }[];
};

export function ApplicationDetailPage() {
  const { id } = useParams();
  const { has } = useAuth();
  const showApplicantDossier = canRegisterApplicants(has);
  const [app, setApp] = useState<App | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    if (!id) return;
    const data = await api<App>(`/api/applications/${id}`);
    setApp(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);

  if (!app) return <div>{error || "Loading application…"}</div>;
  const d = app.details || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-teal">{app.category_name}</div>
          <h2 className="tracking-tight">
            <ReferenceNumber className="text-2xl font-bold">{String(app.reference)}</ReferenceNumber>
          </h2>
          <p className="text-muted">
            {showApplicantDossier ? (
              <Link
                to={`/applicants?view=${app.applicant_profile_id}`}
                className="font-semibold text-teal hover:underline"
                title="View applicant dossier"
              >
                {app.full_name}
              </Link>
            ) : (
              <span className="font-semibold text-navy">{app.full_name}</span>
            )}
            {app.application_year
              ? ` · ${formatSupportYearWithDateTime(app.application_year as number, app.created_at as string)}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {showApplicantDossier && (
            <Link to={`/applicants?view=${app.applicant_profile_id}`}>
              <Button tone="ghost">View beneficiary</Button>
            </Link>
          )}
          <StatusBadge status={app.status} />
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {msg && <div className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{msg}</div>}
      {app.duplicates?.length > 0 && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 border border-amber-200">
          <strong>Possible duplicate matches detected:</strong>
          <ul className="mt-1 list-disc list-inside">
            {app.duplicates.map((x, i) => (
              <li key={i}>{x.detail}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-2xl bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-6">
          <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-3">
            <Info
              label="Applicant Number"
              value={
                showApplicantDossier ? (
                  <Link
                    to={`/applicants?view=${app.applicant_profile_id}`}
                    className={`${referenceNumberClass} font-mono text-xs hover:underline`}
                  >
                    {String(app.applicant_ref)}
                  </Link>
                ) : (
                  <ReferenceNumber>{String(app.applicant_ref)}</ReferenceNumber>
                )
              }
            />
            <Info label="Disability Category" value={String(app.disability_category || "—")} />
            <Info label="Requested" value={<Money pesewas={app.amount_requested_pesewas as number} />} />
            <Info label="Approved" value={<Money pesewas={app.amount_approved_pesewas as number} />} />
            <Info
              label="Support year"
              value={formatSupportYearWithDateTime(app.application_year as number, app.created_at as string)}
            />
            <Info label="Purpose Summary" value={String(app.purpose_summary || "—")} />
            <Info label="Signature / thumbprint" value={String(app.applicant_signature_label || "—")} />
            <Info
              label="Endorsed by:"
              value={String(app.endorsing_officer_name || app.endorsed_by_name || "—")}
            />
            <Info
              label="Endorsed on"
              value={formatAppDateTimeFromIso(app.endorsed_at as string) || "—"}
            />
            <Info
              label="Office use — remarks"
              value={
                app.office_use_qualified === "qualified"
                  ? "Qualified"
                  : app.office_use_qualified === "not_qualified"
                    ? "Not Qualified"
                    : "—"
              }
            />
            {app.office_use_remarks ? (
              <Info label="Office use — notes" value={String(app.office_use_remarks)} />
            ) : null}
            <Info label="Contact Phone" value={String(app.phone || "—")} />
          </div>
          <RegisteredPassportPhoto
            applicantProfileId={app.applicant_profile_id}
            subject={
              app.registration_type === "caregiver" || app.category_code === "caregivers" ? "caregiver" : "beneficiary"
            }
            photoPath={
              app.registration_type === "caregiver" || app.category_code === "caregivers"
                ? (app.caregiver_photo_path as string | null)
                : (app.photo_path as string | null)
            }
            hasPhoto={
              app.documents.some((d) => d.document_type === "passport_photo") ? true : undefined
            }
            size="small"
            align="end"
            className={`shrink-0 ${PASSPORT_PHOTO_PRIMARY_CLASS}`}
            boxMaxWidthClass={PASSPORT_PHOTO_BOX_PRIMARY}
          />
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-navy">Category details</h3>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          {Object.entries(d)
            .filter(([k, v]) => !k.endsWith("_id") && v != null && String(v).trim() !== "")
            .map(([k, v]) => (
              <div key={k}>
                <span className="text-muted">{k.replaceAll("_", " ")}: </span>
                {String(v)}
              </div>
            ))}
        </div>
      </section>

      {/* Documents Section with View / Download Actions */}
      <section className="rounded-2xl bg-surface p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-navy">Verification Documents ({app.documents.length})</h3>
          <span className="text-xs text-muted">Ghana Card & Passport Photo mandatory</span>
        </div>

        {app.documents.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            {app.documents.map((doc) => {
              const fileUrl = `/api/applications/documents/${doc.id}/file?token=${encodeURIComponent(getToken() || "")}`;
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-[#e2e8f0] bg-canvas/40 p-3 text-sm"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy capitalize">
                        {doc.document_type.replaceAll("_", " ")}
                      </span>
                      {doc.is_medical ? (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                          Medical
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-muted" title={doc.original_name}>
                      {doc.original_name}
                    </div>
                  </div>

                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-teal/10 px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal/20"
                  >
                    View File ↗
                  </a>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mb-4 text-sm text-muted">No documents uploaded yet.</p>
        )}

        {has("documents.upload") && ["registration", "returned_for_correction"].includes(app.status) && (
          <UploadForm applicationId={app.id} onDone={load} />
        )}
      </section>

      <ApplicationWorkflowActions
        app={{
          id: app.id,
          reference: app.reference,
          status: app.status,
          category_code: app.category_code,
          application_year: app.application_year as number | undefined,
          amount_requested_pesewas: app.amount_requested_pesewas as number | null,
        }}
        onDone={() => {
          load().then(() => setMsg("Saved.")).catch((e) => setError(e.message));
        }}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <History title="Verification" rows={app.verifications} />
        <History title="Assessments" rows={app.assessments} />
        <History title="Decisions" rows={app.decisions} />
        <History title="Disbursement / fulfilment" rows={[...app.disbursements, ...app.fulfilments]} />
      </section>

      <section className="rounded-2xl bg-surface p-5 shadow-sm">
        <h3 className="mb-3 font-semibold text-navy">Audit timeline</h3>
        <ol className="space-y-2 text-sm">
          {app.events.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 border-b border-canvas pb-2">
              <span>{e.from_status || "new"} → {e.to_status} {e.note ? `· ${e.note}` : ""}</span>
              <span className="text-muted">{formatAppDateTimeFromIso(e.created_at)} · {e.actor_email}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function UploadForm({ applicationId, onDone }: { applicationId: string; onDone: () => Promise<void> }) {
  const [type, setType] = useState("passport_photo");
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = (e.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("documentType", type);
    await fetch(`/api/applications/${applicationId}/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body,
    });
    await onDone();
  }
  return (
    <form onSubmit={send} className="flex flex-wrap items-end gap-2">
      <Field label="Document type">
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="passport_photo">Passport picture</option>
          <option value="ghana_card">Ghana Card</option>
          <option value="admission_letter">Admission letter</option>
          <option value="school_invoice">School invoice</option>
          <option value="medical_receipt">Medical receipt / invoice</option>
          <option value="caregiver_ghana_card">Caregiver Ghana Card</option>
          <option value="supporting">Other supporting document</option>
        </select>
      </Field>
      <input name="file" type="file" className="text-sm" />
      <Button type="submit" tone="ghost">Upload</Button>
    </form>
  );
}


function History({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-sm">
      <h3 className="mb-3 font-semibold text-navy">{title}</h3>
      {!rows.length && <p className="text-sm text-muted">None yet.</p>}
      <ul className="space-y-2 text-xs">
        {rows.map((r) => (
          <li key={String(r.id)} className="rounded-lg bg-canvas p-2">
            {Object.entries(r)
              .filter(([k]) => !["id", "application_id", "officer_user_id", "decision_id"].includes(k))
              .slice(0, 6)
              .map(([k, v]) => (
                <div key={k}><span className="text-muted">{k.replaceAll("_", " ")}: </span>{String(v)}</div>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
