export type StartupToolHistoryRow = {
  id: string;
  reference: string;
  application_year: number;
  tool_name: string;
};

export function normalizeStartupToolName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function startupToolLabelsFromHistory(history: StartupToolHistoryRow[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const row of history) {
    const name = row.tool_name?.trim();
    if (!name) continue;
    const key = normalizeStartupToolName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(name);
  }
  return labels;
}

export function isStartupToolPreviouslyRequested(
  toolName: string,
  history: StartupToolHistoryRow[],
): boolean {
  const key = normalizeStartupToolName(toolName);
  if (!key) return false;
  return history.some((row) => normalizeStartupToolName(row.tool_name || "") === key);
}
