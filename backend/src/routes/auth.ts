import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import multer from "multer";
import { all, get, now, run } from "../db/index.ts";
import { COVERAGE_DISTRICT_CODE } from "../db/policy.ts";
import { audit } from "../lib/audit.ts";
import { loadUser, requireAuth, type AuthUser } from "../lib/auth.ts";
import { DISABILITY_CATEGORIES, RESIDENCE_TYPES } from "../lib/constants.ts";
import { newId, signToken, verifyPassword } from "../lib/crypto.ts";
import { touchUserPresence } from "../lib/presence.ts";
import { workflowScopeForClient } from "../lib/workflow-access.ts";

export const authRouter = Router();

import { uploadsDir } from "../lib/paths.ts";

const uploadRoot = uploadsDir();
fs.mkdirSync(uploadRoot, { recursive: true });

const profilePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadRoot),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      cb(null, `staff-profile-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

authRouter.post("/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = get<{ id: string; password_hash: string; status: string; failed_logins: number; locked_until: string | null }>(
    "SELECT id, password_hash, status, failed_logins, locked_until FROM users WHERE email = ?",
    [email],
  );
  if (!user) {
    audit({ action: "auth.login_failed", metadata: { email }, ip: req.ip, outcome: "denied" });
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(423).json({ error: "Account temporarily locked. Try again later." });
  }
  if (user.status !== "active" || !verifyPassword(password, user.password_hash)) {
    const fails = user.failed_logins + 1;
    const locked = fails >= 8 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    run("UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?", [fails, locked, user.id]);
    audit({ actorUserId: user.id, action: "auth.login_failed", outcome: "denied", ip: req.ip });
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const ts = now();
  run("UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ?, last_seen_at = ? WHERE id = ?", [ts, ts, user.id]);
  const auth = loadUser(user.id)!;
  if (!isStaffPortalUser(auth)) {
    audit({ actorUserId: user.id, action: "auth.login_denied_portal", outcome: "denied", ip: req.ip });
    return res.status(403).json({
      error: "This login is for authorised assembly staff only. Persons with disability and caregivers are registered and assisted at the municipal office.",
    });
  }
  audit({ actorUserId: user.id, action: "auth.login", ip: req.ip });
  res.json({ token: signToken({ sub: user.id, email }), user: publicUser(auth) });
});

authRouter.post("/register", (_req, res) => {
  res.status(403).json({
    error: "Only authorised staff can register applicants. A caregiver or family member cannot register on behalf of a person with disability.",
  });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const user = req.auth!;
  const person = user.person_id
    ? get("SELECT * FROM persons WHERE id = ?", [user.person_id])
    : null;
  const profile = user.person_id
    ? get<Record<string, unknown>>(
        `SELECT ap.*, r.name AS region_name, d.name AS district_name
         FROM applicant_profiles ap
         JOIN regions r ON r.id = ap.region_id
         JOIN districts d ON d.id = ap.district_id
         WHERE ap.person_id = ?`,
        [user.person_id],
      )
    : null;
  const identifiers = user.person_id
    ? all("SELECT id_type, value_normalized, verification_status, nhis_linked_to_ghana_card FROM person_identifiers WHERE person_id = ?", [user.person_id])
    : [];
  const notifications = all(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
    [user.id],
  );
  res.json({ user: publicUser(user), person, profile, identifiers, notifications, workflowScope: workflowScopeForClient(user) });
});

authRouter.post("/presence", requireAuth, (req, res) => {
  touchUserPresence(req.auth!.id);
  res.json({ ok: true, at: now() });
});

function ensureStaffPerson(userId: string, email: string, fullName: string): string {
  const row = get<{ person_id: string | null }>("SELECT person_id FROM users WHERE id = ?", [userId]);
  if (row?.person_id) return row.person_id;
  const ts = now();
  const personId = newId("per");
  run(
    `INSERT INTO persons (id, full_name, date_of_birth, age, sex, phone, email, home_address, photo_path, created_at, updated_at)
     VALUES (?,?,NULL,NULL,NULL,?,?,NULL,NULL,?,?)`,
    [personId, fullName, null, email, ts, ts],
  );
  run("UPDATE users SET person_id = ? WHERE id = ?", [personId, userId]);
  return personId;
}

authRouter.patch("/profile", requireAuth, (req, res) => {
  const fullName = String(req.body?.fullName || "").trim();
  if (fullName.length < 2) return res.status(400).json({ error: "Display name is required (at least 2 characters)." });
  const user = req.auth!;
  const personId = ensureStaffPerson(user.id, user.email, fullName);
  run("UPDATE persons SET full_name = ?, updated_at = ? WHERE id = ?", [fullName, now(), personId]);
  audit({ actorUserId: user.id, action: "profile.update", entityType: "user", entityId: user.id, metadata: { fullName } });
  res.json({ ok: true, fullName });
});

authRouter.post("/profile-photo", requireAuth, profilePhotoUpload.single("photo"), (req, res) => {
  const user = req.auth!;
  if (!req.file) return res.status(400).json({ error: "Photo file is required" });
  const personId = ensureStaffPerson(user.id, user.email, user.email.split("@")[0] || "Staff");
  const previous = get<{ photo_path: string | null }>("SELECT photo_path FROM persons WHERE id = ?", [personId]);
  const ts = now();
  run("UPDATE persons SET photo_path = ?, updated_at = ? WHERE id = ?", [req.file.filename, ts, personId]);
  if (previous?.photo_path && previous.photo_path !== req.file.filename) {
    const oldPath = path.join(uploadRoot, previous.photo_path);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  audit({ actorUserId: user.id, action: "profile.photo", entityType: "user", entityId: user.id });
  res.status(201).json({ photoPath: req.file.filename });
});

authRouter.get("/profile-photo", requireAuth, (req, res) => {
  const user = req.auth!;
  if (!user.person_id) return res.status(404).json({ error: "No staff profile photo" });
  const person = get<{ photo_path: string | null }>("SELECT photo_path FROM persons WHERE id = ?", [user.person_id]);
  if (!person?.photo_path?.trim()) return res.status(404).json({ error: "No profile photo on file" });
  const filePath = path.join(uploadRoot, person.photo_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Photo file missing" });
  res.setHeader("Cache-Control", "private, no-store");
  res.sendFile(filePath);
});

authRouter.get("/lookups", (_req, res) => {
  const districts = all(
    `SELECT d.id, d.code, d.name, d.region_id, r.name AS region_name
     FROM districts d JOIN regions r ON r.id = d.region_id
     WHERE d.is_active = 1 AND d.code = ? ORDER BY d.name`,
    [COVERAGE_DISTRICT_CODE],
  );
  const regions = all(
    `SELECT DISTINCT r.id, r.code, r.name
     FROM regions r JOIN districts d ON d.region_id = r.id
     WHERE d.is_active = 1 AND d.code = ? ORDER BY r.name`,
    [COVERAGE_DISTRICT_CODE],
  );
  const categories = all("SELECT code, name, description, required_documents, is_active, sort_order FROM support_categories ORDER BY sort_order");
  res.json({
    regions,
    districts,
    categories,
    disabilities: DISABILITY_CATEGORIES,
    residenceTypes: RESIDENCE_TYPES,
  });
});

function isStaffPortalUser(user: AuthUser) {
  return user.roles.some((role) => role !== "applicant" && role !== "caregiver");
}

export function publicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    personId: user.person_id,
    roles: user.roles,
    permissions: user.permissions,
    scopes: user.scopes,
  };
}
