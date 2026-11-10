/** Application endorsement is recorded on submit — not the registration officer. */
export function applicationEndorsedByDisplay(
  app:
    | {
        endorsing_officer_name?: string | null;
        endorsed_by_name?: string | null;
      }
    | null
    | undefined,
): string {
  if (!app) return "—";
  const name = app.endorsing_officer_name?.trim() || app.endorsed_by_name?.trim();
  return name || "—";
}
