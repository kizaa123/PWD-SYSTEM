import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { formatAppDateTimeFromIso } from "../lib/dateFormat";
import { inputClass } from "../components/StatusBadge";
import { PageTitle } from "../components/PageTitle";
import { LoadingSpinner } from "../components/GlobalLoadingBar";

type ActiveStaff = {
  id: string;
  email: string;
  full_name: string | null;
  last_seen_at: string;
  last_login_at: string | null;
  roles: string[];
};

type AuditPayload = {
  activeStaff: ActiveStaff[];
  activeWindowMinutes: number;
  generatedAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  registration_officer: "Social Welfare Officer",
  verification_officer: "Interview Officer",
  assessment_officer: "Interview Officer",
  district_officer: "District Officer",
  finance_officer: "Finance Officer",
  regional_officer: "Regional Officer",
  national_admin: "National Administrator",
  system_admin: "System Administrator",
  fund_committee: "Final approver",
};

function staffLabel(roles: string[]) {
  const code = roles.find((r) => r !== "applicant" && r !== "caregiver") || roles[0] || "";
  return ROLE_LABELS[code] || code.replaceAll("_", " ");
}

function relativeSeen(iso: string) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 15) return "Just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return `${min} min ago`;
}

export function AuditPage() {
  const [activeStaff, setActiveStaff] = useState<ActiveStaff[]>([]);
  const [windowMin, setWindowMin] = useState(5);
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRefreshing(true);
    return api<AuditPayload>("/api/audit")
      .then((data) => {
        setActiveStaff(data.activeStaff);
        setWindowMin(data.activeWindowMinutes);
      })
      .catch(() => setActiveStaff([]))
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => load(), 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return activeStaff;
    return activeStaff.filter((s) => {
      const name = (s.full_name || "").toLowerCase();
      const email = s.email.toLowerCase();
      const role = staffLabel(s.roles).toLowerCase();
      return name.includes(needle) || email.includes(needle) || role.includes(needle);
    });
  }, [activeStaff, q]);

  return (
    <div className="space-y-4">
      <PageTitle
        title="Audit Log"
        subtitle={`Staff currently signed in and using the portal. Updates every 15 seconds (active within ${windowMin} minutes).`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} w-full sm:max-w-md`}
          placeholder="Search name, username or role"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {refreshing ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <LoadingSpinner className="h-4 w-4 text-teal" />
            Refreshing…
          </span>
        ) : null}
      </div>

      <div className="data-table-scroll rounded-2xl bg-surface shadow-sm">
        <table className="data-table text-left text-sm">
          <thead className="bg-canvas text-muted">
            <tr>
              <th>Staff</th>
              <th>Role</th>
              <th>Username</th>
              <th className="table-cell-tight">Last active</th>
              <th className="table-cell-nowrap-sm">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted">
                  {activeStaff.length === 0
                    ? "No staff are active on the system right now."
                    : "No active staff match your search."}
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const name = s.full_name?.trim() || s.email;
                return (
                  <tr key={s.id} className="border-t border-canvas">
                    <td className="font-medium text-navy">{name}</td>
                    <td className="capitalize">{staffLabel(s.roles)}</td>
                    <td className="text-muted">{s.email}</td>
                    <td className="table-cell-tight">
                      <div>{formatAppDateTimeFromIso(s.last_seen_at) || "—"}</div>
                      <div className="text-xs text-muted">{relativeSeen(s.last_seen_at)}</div>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 font-medium text-success">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                        </span>
                        Active
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
