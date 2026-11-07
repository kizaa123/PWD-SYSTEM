import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Field, ReferenceNumber, inputClass } from "./StatusBadge";

export type WorkflowApp = {
  id: string;
  reference: string;
  status: string;
  category_code?: string;
  application_year?: number;
  amount_requested_pesewas: number | null;
};

type Props = {
  app: WorkflowApp;
  onDone: () => void;
  variant?: "compact" | "panel";
  onNavigate?: () => void;
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-teal/40 bg-surface p-5 shadow-sm">
      <h3 className="mb-3 font-semibold text-navy">{title}</h3>
      {children}
    </section>
  );
}

export function ApplicationWorkflowActions({ app, onDone, variant = "panel", onNavigate }: Props) {
  const { has, isRole } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comments, setComments] = useState("");
  const [findings, setFindings] = useState("");
  const [assessAmount, setAssessAmount] = useState("");
  const [decideReason, setDecideReason] = useState("");
  const [decideAmount, setDecideAmount] = useState(
    app.amount_requested_pesewas ? String(app.amount_requested_pesewas / 100) : "",
  );
  const [disburseAmount, setDisburseAmount] = useState("");
  const [itemDescription, setItemDescription] = useState("");

  const compact = variant === "compact";
  const wrap = compact
    ? (title: string, children: React.ReactNode) => (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-teal">{title}</div>
          {children}
        </div>
      )
    : (title: string, children: React.ReactNode) => <Panel title={title}>{children}</Panel>;

  async function post(path: string, body: Record<string, unknown>) {
    setError("");
    setBusy(true);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const blocks: React.ReactNode[] = [];
  const category = app.category_code || "";
  const toolCategory = category === "income_generating" || category === "assistive_device";

  if (has("applications.submit") && ["registration", "returned_for_correction"].includes(app.status)) {
    blocks.push(
      wrap(
        "Phase I — Registration",
        <div className="space-y-2">
          {!compact && (
            <p className="text-sm text-muted">
              Confirm Ghana Card and passport photo, then complete registration. The case moves to interview. Reference:{" "}
              <ReferenceNumber>{app.reference}</ReferenceNumber>
              {app.application_year ? ` · ${app.application_year} cycle` : ""}
            </p>
          )}
          <Button type="button" disabled={busy} onClick={() => post(`/api/applications/${app.id}/submit`, {})}>
            {busy ? "Working…" : "Complete registration → Interview"}
          </Button>
        </div>,
      ),
    );
  }

  if (["returned_for_correction"].includes(app.status) && (has("applications.create") || has("applications.submit"))) {
    blocks.push(
      wrap(
        "Correction",
        <Link to={`/applications/${app.id}`} onClick={onNavigate}>
          <Button type="button" tone="gold">
            Edit request &amp; documents
          </Button>
        </Link>,
      ),
    );
  }

  if ((has("verification.perform") || has("assessment.perform")) && app.status === "interview") {
    blocks.push(
      wrap(
        "Phase II — Interview",
        <div className="space-y-2">
          <div className={`flex flex-wrap gap-2 ${compact ? "" : "mb-3"}`}>
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                post(`/api/applications/${app.id}/verify`, {
                  outcome: "verified",
                  identityOk: true,
                  documentsOk: true,
                  completenessOk: true,
                  comments,
                  findings,
                  recommendedAmount: assessAmount ? Number(assessAmount) : null,
                })
              }
            >
              Complete interview → Selection
            </Button>
            <Button
              type="button"
              tone="gold"
              disabled={busy}
              onClick={() => post(`/api/applications/${app.id}/verify`, { outcome: "returned", comments })}
            >
              Return for correction
            </Button>
          </div>
          <div className={`grid gap-2 ${compact ? "sm:grid-cols-2" : "md:grid-cols-2"}`}>
            <Field label="Recommended amount (GHS)">
              <input className={inputClass} value={assessAmount} onChange={(e) => setAssessAmount(e.target.value)} />
            </Field>
            <Field label="Interview notes / findings">
              <textarea
                className={`${inputClass} ${compact ? "min-h-[2.5rem]" : ""}`}
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                rows={compact ? 2 : 3}
              />
            </Field>
          </div>
          <textarea
            className={`${inputClass} ${compact ? "min-h-[2.5rem] text-sm" : ""}`}
            placeholder="Comments / missing items"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={compact ? 2 : 3}
          />
        </div>,
      ),
    );
  }

  if (has("decision.approve") && isRole("fund_committee") && app.status === "selection") {
    blocks.push(
      wrap(
        "Phase III — Selection",
        <div className="space-y-2">
          {!compact && <p className="text-sm text-muted">Committee selects beneficiaries and authorised support amounts.</p>}
          <div className={`grid gap-2 ${compact ? "sm:grid-cols-2" : "md:grid-cols-2"}`}>
            <Field label="Authorized amount (GHS)">
              <input className={inputClass} value={decideAmount} onChange={(e) => setDecideAmount(e.target.value)} />
            </Field>
            <Field label="Reason (required)">
              <textarea
                className={`${inputClass} ${compact ? "min-h-[2.5rem]" : ""}`}
                value={decideReason}
                onChange={(e) => setDecideReason(e.target.value)}
                rows={compact ? 2 : 3}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() =>
                post(`/api/applications/${app.id}/decide`, {
                  outcome: "approved",
                  reason: decideReason,
                  authorizedAmount: decideAmount ? Number(decideAmount) : null,
                })
              }
            >
              Select → Disbursement
            </Button>
            <Button type="button" tone="danger" disabled={busy} onClick={() => post(`/api/applications/${app.id}/decide`, { outcome: "rejected", reason: decideReason })}>
              Not selected (reject)
            </Button>
            <Button type="button" tone="ghost" disabled={busy} onClick={() => post(`/api/applications/${app.id}/decide`, { outcome: "returned", reason: decideReason })}>
              Return
            </Button>
          </div>
        </div>,
      ),
    );
  }

  if (has("fulfilment.record") && ["disbursement", "partially_fulfilled"].includes(app.status)) {
    blocks.push(
      wrap(
        "Phase IV — Disbursement / Final",
        <div className="space-y-2">
          {!toolCategory && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Disburse amount (GHS)">
                <input className={inputClass} value={disburseAmount} onChange={(e) => setDisburseAmount(e.target.value)} />
              </Field>
              <Button
                type="button"
                disabled={busy}
                onClick={() => post(`/api/applications/${app.id}/disburse`, { amount: Number(disburseAmount), channel: "recorded_transfer" })}
              >
                Record disbursement
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Item / tool delivered">
              <input className={inputClass} value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} />
            </Field>
            <Button
              type="button"
              tone="ghost"
              disabled={busy}
              onClick={() => post(`/api/applications/${app.id}/fulfil`, { itemDescription, complete: true })}
            >
              Mark complete (final)
            </Button>
          </div>
        </div>,
      ),
    );
  }

  if (blocks.length === 0) {
    if (has("applications.read")) {
      return (
        <p className="text-sm text-muted">
          No workflow actions for status <span className="font-medium text-navy">{app.status.replace(/_/g, " ")}</span>.{" "}
          <Link className="text-teal underline" to={`/applications/${app.id}`} onClick={onNavigate}>
            Open full case
          </Link>
        </p>
      );
    }
    return null;
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {error && <p className="text-sm text-danger">{error}</p>}
      {blocks}
      {has("applications.read") && compact && (
        <Link className="inline-block text-xs font-medium text-teal underline" to={`/applications/${app.id}`} onClick={onNavigate}>
          Open full case (documents &amp; history)
        </Link>
      )}
    </div>
  );
}

const ACTION_STATUS_PRIORITY = [
  "returned_for_correction",
  "registration",
  "interview",
  "selection",
  "disbursement",
  "partially_fulfilled",
] as const;

export function pickWorkflowApp<T extends { id: string; status: string }>(apps: T[]): T | undefined {
  for (const status of ACTION_STATUS_PRIORITY) {
    const found = apps.find((a) => a.status === status);
    if (found) return found;
  }
  return apps[0];
}
