/** True when the browser reports connectivity and the API answers. */
export function browserOnline() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export async function apiReachable(timeoutMs = 4000): Promise<boolean> {
  if (!browserOnline()) return false;
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch("/api/health", { signal: ctrl.signal, cache: "no-store" });
    window.clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export function isLikelyNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|network|load failed|aborted/i.test(msg);
}
