const KEY = "pwd_lookups_cache_v1";

export type CachedLookups = {
  regions: { id: string; name: string }[];
  districts: { id: string; name: string; region_id: string }[];
  disabilities: string[];
  categories?: { code: string; name: string; description: string }[];
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

export function writeLookupsCache(data: Partial<Omit<CachedLookups, "cachedAt">>) {
  const prev = readLookupsCache();
  const payload: CachedLookups = {
    regions: data.regions ?? prev?.regions ?? [],
    districts: data.districts ?? prev?.districts ?? [],
    disabilities: data.disabilities ?? prev?.disabilities ?? [],
    categories: data.categories ?? prev?.categories,
    cachedAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
}
