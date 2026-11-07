import type { NextFunction, Request, Response } from "express";
import { all, get } from "../db/index.ts";
import { verifyToken } from "./crypto.ts";
import { touchUserPresence } from "./presence.ts";

export type AuthUser = {
  id: string;
  email: string;
  status: string;
  person_id: string | null;
  roles: string[];
  permissions: string[];
  scopes: { scope_level: string; region_id: string | null; district_id: string | null }[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export function loadUser(userId: string): AuthUser | null {
  const user = get<{ id: string; email: string; status: string; person_id: string | null }>(
    "SELECT id, email, status, person_id FROM users WHERE id = ?",
    [userId],
  );
  if (!user || user.status !== "active") return null;
  const roles = all<{ code: string }>(
    `SELECT r.code FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?`,
    [userId],
  ).map((r) => r.code);
  const permissions = all<{ code: string }>(
    `SELECT DISTINCT p.code
     FROM permissions p
     JOIN role_permissions rp ON rp.permission_id = p.id
     JOIN user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = ?`,
    [userId],
  ).map((p) => p.code);
  const scopes = all<{ scope_level: string; region_id: string | null; district_id: string | null }>(
    "SELECT scope_level, region_id, district_id FROM user_scopes WHERE user_id = ?",
    [userId],
  );
  return { ...user, roles, permissions, scopes };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : typeof req.query.token === "string"
      ? req.query.token
      : "";
  if (!token) return res.status(401).json({ error: "Authentication required" });
  const payload = verifyToken(token);
  if (!payload || typeof payload.sub !== "string") return res.status(401).json({ error: "Invalid or expired session" });
  const user = loadUser(payload.sub);
  if (!user) return res.status(401).json({ error: "Account is not active" });
  req.auth = user;
  touchUserPresence(user.id);
  next();
}

export function requirePermission(...codes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Authentication required" });
    const ok = codes.some((c) => req.auth!.permissions.includes(c));
    if (!ok) return res.status(403).json({ error: "You do not have permission for this action" });
    next();
  };
}

export function canAccessGeo(user: AuthUser, regionId: string, districtId: string): boolean {
  if (user.roles.includes("applicant") || user.roles.includes("caregiver")) return false;
  return user.scopes.some((s) => {
    if (s.scope_level === "national") return true;
    if (s.scope_level === "region" && s.region_id === regionId) return true;
    if (s.scope_level === "district" && s.district_id === districtId) return true;
    return false;
  });
}

export function geoFilterSql(user: AuthUser, regionCol = "a.region_id", districtCol = "a.district_id"): { sql: string; params: string[] } {
  if (user.scopes.some((s) => s.scope_level === "national")) return { sql: "1=1", params: [] };
  const parts: string[] = [];
  const params: string[] = [];
  for (const s of user.scopes) {
    if (s.scope_level === "region" && s.region_id) {
      parts.push(`${regionCol} = ?`);
      params.push(s.region_id);
    }
    if (s.scope_level === "district" && s.district_id) {
      parts.push(`${districtCol} = ?`);
      params.push(s.district_id);
    }
  }
  if (!parts.length) return { sql: "1=0", params: [] };
  return { sql: `(${parts.join(" OR ")})`, params };
}
