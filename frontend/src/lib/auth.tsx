import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken } from "./api";
import { isLikelyNetworkError } from "./connection";

export type AuthUser = {
  id: string;
  email: string;
  personId: string | null;
  roles: string[];
  permissions: string[];
  scopes: { scope_level: string; region_id: string | null; district_id: string | null }[];
};

type AuthState = {
  user: AuthUser | null;
  profile: Record<string, unknown> | null;
  person: Record<string, unknown> | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  has: (...perm: string[]) => boolean;
  isRole: (...roles: string[]) => boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);
const USER_CACHE_KEY = "pwd_user_cache";

type MePayload = {
  user: AuthUser;
  profile: Record<string, unknown> | null;
  person: Record<string, unknown> | null;
};

function readCachedMe(): MePayload | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MePayload;
  } catch {
    return null;
  }
}

function writeCachedMe(me: MePayload) {
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify(me));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [person, setPerson] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<MePayload>("/api/auth/me");
      setUser(me.user);
      setProfile(me.profile);
      setPerson(me.person);
      writeCachedMe(me);
    } catch (e) {
      const cached = readCachedMe();
      const offline =
        (typeof navigator !== "undefined" && !navigator.onLine) || isLikelyNetworkError(e);
      if (cached && offline) {
        setUser(cached.user);
        setProfile(cached.profile);
        setPerson(cached.person);
      } else {
        setToken(null);
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      person,
      loading,
      async login(email, password) {
        const res = await api<{ token: string; user: AuthUser }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        setToken(res.token);
        setUser(res.user);
        await refresh();
      },
      logout() {
        setToken(null);
        setUser(null);
        setProfile(null);
        setPerson(null);
        localStorage.removeItem(USER_CACHE_KEY);
      },
      has: (...perm) => Boolean(user && perm.some((p) => user.permissions.includes(p))),
      isRole: (...roles) => Boolean(user && roles.some((r) => user.roles.includes(r))),
      refresh,
    }),
    [user, profile, person, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside provider");
  return ctx;
}
