import type { AuthUser } from "./auth.ts";

const TERMINAL = new Set(["completed", "rejected", "cancelled"]);

/** Statuses a user may list/open based on workflow role — `null` means full read-only oversight. */
export function visibleApplicationStatuses(user: AuthUser): string[] | null {
  if (user.roles.includes("applicant") || user.roles.includes("caregiver")) {
    return null;
  }

  const statuses = new Set<string>();

  if (user.permissions.includes("applications.submit") || user.permissions.includes("applications.create")) {
    statuses.add("registration");
    statuses.add("returned_for_correction");
  }
  if (user.permissions.includes("verification.perform") || user.permissions.includes("assessment.perform")) {
    statuses.add("interview");
  }
  if (user.permissions.includes("decision.approve") && user.roles.includes("fund_committee")) {
    statuses.add("selection");
    statuses.add("on_hold");
  }
  if (user.permissions.includes("fulfilment.record")) {
    statuses.add("disbursement");
    statuses.add("partially_fulfilled");
  }

  if (statuses.size === 0) {
    if (user.permissions.includes("applications.read")) return null;
    return [];
  }
  return [...statuses];
}

export function canViewApplicationStatus(user: AuthUser, status: string): boolean {
  const visible = visibleApplicationStatuses(user);
  if (visible === null) return true;
  return visible.includes(status);
}

export function sqlStatusFilter(user: AuthUser, column = "a.status"): { sql: string; params: string[] } | null {
  const visible = visibleApplicationStatuses(user);
  if (visible === null) return null;
  if (visible.length === 0) return { sql: "1 = 0", params: [] };
  const placeholders = visible.map(() => "?").join(", ");
  return { sql: `${column} IN (${placeholders})`, params: visible };
}

export type WorkflowQueue = { status: string; label: string };

export function workflowQueuesForUser(user: AuthUser): WorkflowQueue[] {
  const queues: WorkflowQueue[] = [];
  if (user.permissions.includes("applications.submit") || user.permissions.includes("applications.create")) {
    queues.push({ status: "registration", label: "Registration" });
  }
  if (user.permissions.includes("verification.perform") || user.permissions.includes("assessment.perform")) {
    queues.push({ status: "interview", label: "Interview" });
  }
  if (user.permissions.includes("decision.approve") && user.roles.includes("fund_committee")) {
    queues.push({ status: "selection", label: "Selection" });
  }
  if (user.permissions.includes("fulfilment.record")) {
    queues.push({ status: "disbursement", label: "Disbursement" });
  }
  return queues;
}

/** Social welfare register and maintain the permanent applicant register. */
export function canAccessApplicantRegister(user: AuthUser): boolean {
  return user.permissions.includes("applicants.create");
}

export function applicantListSqlExtra(user: AuthUser): { sql: string; params: string[] } | null {
  if (canAccessApplicantRegister(user)) return null;
  const visible = visibleApplicationStatuses(user);
  if (visible === null) return null;
  if (visible.length === 0) return { sql: "1 = 0", params: [] };
  const placeholders = visible.map(() => "?").join(", ");
  return {
    sql: `EXISTS (SELECT 1 FROM applications ax WHERE ax.applicant_profile_id = ap.id AND ax.status IN (${placeholders}))`,
    params: visible,
  };
}

export function isOversightReader(user: AuthUser): boolean {
  return visibleApplicationStatuses(user) === null && user.permissions.includes("applications.read");
}

export function workflowScopeForClient(user: AuthUser) {
  return {
    visibleStatuses: visibleApplicationStatuses(user),
    queues: workflowQueuesForUser(user),
    canRegisterApplicants: canAccessApplicantRegister(user),
    oversight: isOversightReader(user),
    terminalHidden: [...TERMINAL],
  };
}
