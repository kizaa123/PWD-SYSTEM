import type { AuthUser } from "./auth";

export type WorkflowQueue = { status: string; label: string; to: string };

export function visibleApplicationStatuses(user: AuthUser | null, has: (...p: string[]) => boolean, isRole: (...r: string[]) => boolean): string[] | null {
  if (!user) return [];
  if (user.roles.includes("applicant") || user.roles.includes("caregiver")) return null;

  const statuses = new Set<string>();
  if (has("applications.submit", "applications.create")) {
    statuses.add("registration");
    statuses.add("returned_for_correction");
  }
  if (has("verification.perform", "assessment.perform")) {
    statuses.add("interview");
  }
  if (has("decision.approve") && isRole("fund_committee")) {
    statuses.add("selection");
    statuses.add("on_hold");
  }
  if (has("fulfilment.record")) {
    statuses.add("disbursement");
    statuses.add("partially_fulfilled");
  }

  if (statuses.size === 0) {
    if (has("applications.read")) return null;
    return [];
  }
  return [...statuses];
}

export function workflowQueues(user: AuthUser | null, has: (...p: string[]) => boolean, isRole: (...r: string[]) => boolean): WorkflowQueue[] {
  if (!user) return [];
  const out: WorkflowQueue[] = [];
  if (has("applications.submit", "applications.create")) {
    out.push({ status: "registration", label: "Registration", to: "/applications" });
  }
  if (has("verification.perform", "assessment.perform")) {
    out.push({ status: "interview", label: "Interview", to: "/applications?status=interview" });
  }
  if (has("decision.approve") && isRole("fund_committee")) {
    out.push({ status: "selection", label: "Selection", to: "/applications?status=selection" });
  }
  if (has("fulfilment.record")) {
    out.push({ status: "disbursement", label: "Disbursement", to: "/applications?status=disbursement" });
  }
  return out;
}

export function canRegisterApplicants(has: (...p: string[]) => boolean): boolean {
  return has("applicants.create");
}

export function isOversightReader(user: AuthUser | null, has: (...p: string[]) => boolean, isRole: (...r: string[]) => boolean): boolean {
  return visibleApplicationStatuses(user, has, isRole) === null && has("applications.read");
}

export function canOpenApplicationsList(user: AuthUser | null, has: (...p: string[]) => boolean, isRole: (...r: string[]) => boolean): boolean {
  return isOversightReader(user, has, isRole);
}
