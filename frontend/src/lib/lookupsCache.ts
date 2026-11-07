const KEY = "pwd_lookups_cache_v1";

export type CachedLookups = {
  regions: { id: string; name: string }[];
  districts: { id: string; name: string; region_id: string }[];
  disabilities: string[];
  cachedAt: string;
};

export function readLookupsCache(): CachedLookups | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedLookups;
  } catch {
    return null;
  }
}

export function writeLookupsCache(data: Omit<CachedLookups, "cachedAt">) {
  const payload: CachedLookups = { ...data, cachedAt: new Date().toISOString() };
  localStorage.setItem(KEY, JSON.stringify(payload));
}
