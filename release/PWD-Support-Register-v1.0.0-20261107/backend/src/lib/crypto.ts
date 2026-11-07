import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const TOKEN_SECRET = process.env.PWD_TOKEN_SECRET || "pwd-dev-secret-change-in-production";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, salt, hash] = stored.split(":");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export function signToken(payload: Record<string, unknown>, ttlSeconds = 60 * 60 * 8): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds, iat: Math.floor(Date.now() / 1000) }),
  ).toString("base64url");
  const sig = createHmac("sha256", TOKEN_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = createHmac("sha256", TOKEN_SECRET).update(`${header}.${body}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function newId(prefix = ""): string {
  const id = randomBytes(16).toString("hex");
  return prefix ? `${prefix}_${id}` : id;
}

export function applicationReference(): string {
  const year = new Date().getFullYear();
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `PWD-${year}-${rand}`;
}

export function applicantReference(): string {
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `NCPD-${rand}`;
}

export function normalizeIdentifier(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function maskIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (v.length <= 4) return "••••";
  return `${"•".repeat(Math.max(0, v.length - 4))}${v.slice(-4)}`;
}
