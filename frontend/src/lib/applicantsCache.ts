const LIST_KEY = "pwd_applicants_list_v1";
const DETAIL_PREFIX = "pwd_applicant_detail_v1:";

export function writeApplicantsListCache(rows: unknown[]) {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify({ rows, cachedAt: new Date().toISOString() }));
  } catch {
    /* quota */
  }
}

export function readApplicantsListCache<T>(): T[] | null {
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rows: T[] };
    return parsed.rows?.length ? parsed.rows : null;
  } catch {
    return null;
  }
}

export function writeApplicantDetailCache(id: string, detail: unknown) {
  try {
    localStorage.setItem(`${DETAIL_PREFIX}${id}`, JSON.stringify({ detail, cachedAt: new Date().toISOString() }));
  } catch {
    /* quota */
  }
}

export function readApplicantDetailCache<T>(id: string): T | null {
  try {
    const raw = localStorage.getItem(`${DETAIL_PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { detail: T };
    return parsed.detail ?? null;
  } catch {
    return null;
  }
}
