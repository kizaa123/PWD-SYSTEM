/** Staff assembly portal — not the removed PWD/caregiver self-service portal. */
export function isStaffPortalUser(roles: string[]) {
  if (!roles.length) return false;
  return roles.some((role) => role !== "applicant" && role !== "caregiver");
}
