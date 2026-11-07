import { all, get, now, run } from "../db/index.ts";
import { WORKFLOW, type AppStatus } from "./constants.ts";
import { newId } from "./crypto.ts";
import { notify } from "./audit.ts";
import type { AuthUser } from "./auth.ts";

export function canTransition(from: string, to: string): boolean {
  const allowed = WORKFLOW[from as AppStatus] as readonly string[] | undefined;
  return Boolean(allowed && allowed.includes(to));
}

export function changeStatus(opts: {
  applicationId: string;
  to: string;
  actor: AuthUser;
  note?: string;
  extra?: { amountApproved?: number | null };
}) {
  const app = get<{ id: string; status: string; created_by_user_id: string | null }>(
    "SELECT id, status, created_by_user_id FROM applications WHERE id = ?",
    [opts.applicationId],
  );
  if (!app) throw Object.assign(new Error("Application not found"), { status: 404 });
  if (!canTransition(app.status, opts.to)) {
    throw Object.assign(new Error(`Cannot move from ${app.status} to ${opts.to}`), { status: 400 });
  }
  const ts = now();
  if (opts.extra?.amountApproved != null) {
    run("UPDATE applications SET status = ?, amount_approved_pesewas = ?, updated_at = ? WHERE id = ?", [
      opts.to,
      opts.extra.amountApproved,
      ts,
      opts.applicationId,
    ]);
  } else {
    run("UPDATE applications SET status = ?, updated_at = ? WHERE id = ?", [opts.to, ts, opts.applicationId]);
  }
  run(
    "INSERT INTO application_events (id, application_id, from_status, to_status, actor_user_id, note, created_at) VALUES (?,?,?,?,?,?,?)",
    [newId("evt"), opts.applicationId, app.status, opts.to, opts.actor.id, opts.note ?? null, ts],
  );
  if (app.created_by_user_id) {
    notify(app.created_by_user_id, opts.applicationId, "Application status updated", `Status is now ${opts.to.replaceAll("_", " ")}.`);
  }
}

export function findDuplicates(opts: {
  ghanaCard?: string | null;
  nhis?: string | null;
  personId?: string | null;
  category?: string | null;
  excludeApplicationId?: string | null;
}) {
  const matches: { type: string; detail: string; id: string }[] = [];
  if (opts.ghanaCard) {
    const rows = all<{ person_id: string; full_name: string }>(
      `SELECT pi.person_id, p.full_name
       FROM person_identifiers pi JOIN persons p ON p.id = pi.person_id
       WHERE pi.id_type = 'ghana_card' AND pi.value_normalized = ?`,
      [opts.ghanaCard],
    );
    for (const r of rows) {
      if (opts.personId && r.person_id === opts.personId) continue;
      matches.push({ type: "ghana_card", detail: `Possible duplicate Ghana Card for ${r.full_name}`, id: r.person_id });
    }
  }
  if (opts.nhis) {
    const rows = all<{ person_id: string; full_name: string }>(
      `SELECT pi.person_id, p.full_name
       FROM person_identifiers pi JOIN persons p ON p.id = pi.person_id
       WHERE pi.id_type = 'nhis' AND pi.value_normalized = ?`,
      [opts.nhis],
    );
    for (const r of rows) {
      if (opts.personId && r.person_id === opts.personId) continue;
      matches.push({ type: "nhis", detail: `Possible duplicate NHIS for ${r.full_name}`, id: r.person_id });
    }
  }
  if (opts.personId && opts.category) {
    const year = new Date().getFullYear();
    const open = all<{ id: string; reference: string; status: string; application_year: number }>(
      `SELECT id, reference, status, application_year FROM applications
       WHERE applicant_profile_id = (SELECT id FROM applicant_profiles WHERE person_id = ?)
         AND category_code = ?
         AND application_year = ?
         AND status NOT IN ('rejected','cancelled','completed')
         ${opts.excludeApplicationId ? "AND id <> ?" : ""}`,
      opts.excludeApplicationId
        ? [opts.personId, opts.category, year, opts.excludeApplicationId]
        : [opts.personId, opts.category, year],
    );
    for (const r of open) {
      matches.push({ type: "open_application", detail: `Open ${opts.category} application ${r.reference} (${r.status})`, id: r.id });
    }
  }
  return matches;
}
