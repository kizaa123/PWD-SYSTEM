import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import multer from "multer";
import { all, get, now, run } from "../db/index.ts";
import { audit } from "../lib/audit.ts";
import { geoFilterSql, requireAuth, requirePermission } from "../lib/auth.ts";
import { hashPassword, newId } from "../lib/crypto.ts";
import { applicantProfileIdsAppliedForYear, currentApplicationYear } from "../lib/applications-core.ts";
import { loadAvailableReportYears, loadYearDashboardStats } from "../lib/dashboard-stats.ts";
import { loadReportRosters } from "../lib/report-rosters.ts";
import { STATUS_LABELS } from "../lib/constants.ts";
import { ACTIVE_STAFF_WINDOW_MINUTES, loadActiveStaff } from "../lib/presence.ts";
import { sqlStatusFilter } from "../lib/workflow-access.ts";

export const adminRouter = Router();
adminRouter.use(requireAuth);

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

adminRouter.get("/dashboard", (req, res) => {
  const user = req.auth!;
  const geo = user.roles.includes("applicant") || user.roles.includes("caregiver")
    ? { sql: "a.created_by_user_id = ?", params: [user.id] }
    : geoFilterSql(user);
  const phase = sqlStatusFilter(user, "a.status");
  const phaseSql = phase ? ` AND ${phase.sql}` : "";
  const phaseParams = phase ? phase.params : [];
  const isWelfare = user.permissions.includes("applicants.create");

  const counts = all<{ status: string; c: number }>(
    `SELECT a.status, COUNT(*) AS c FROM applications a WHERE ${geo.sql}${phaseSql} GROUP BY a.status`,
    [...geo.params, ...phaseParams],
  );
  const byStatus: Record<string, number> = {};
  for (const row of counts) byStatus[row.status] = row.c;

  const applicants = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM applicant_profiles ap WHERE ${geo.sql.replaceAll("a.", "ap.")}`,
    geo.params,
  )?.c || 0;

  // Totals across the full geo (not limited to current queue phase) for welfare cards.
  const applicationsTotal = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM applications a WHERE ${geo.sql}`,
    geo.params,
  )?.c || 0;
  const rejected = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM applications a WHERE ${geo.sql} AND a.status = 'rejected'`,
    geo.params,
  )?.c || 0;

  const year = currentApplicationYear();
  const yearStats = loadYearDashboardStats(user, year);
  const appliedThisYear = applicantProfileIdsAppliedForYear(year);

  const recent = all(
    `SELECT a.id, a.applicant_profile_id, a.reference, a.status, a.category_code, a.updated_at, p.full_name, d.name AS district_name, r.name AS region_name,
            rp.full_name AS endorsed_by_name
     FROM applications a
     JOIN applicant_profiles ap ON ap.id = a.applicant_profile_id
     JOIN persons p ON p.id = ap.person_id
     JOIN districts d ON d.id = a.district_id
     JOIN regions r ON r.id = a.region_id
     LEFT JOIN users ru ON ru.id = ap.registered_by_user_id
     LEFT JOIN persons rp ON rp.id = ru.person_id
     WHERE ${geo.sql}${phaseSql}
     ORDER BY a.updated_at DESC LIMIT 8`,
    [...geo.params, ...phaseParams],
  ).map((row: Record<string, unknown>) => ({
    ...row,
    applied_current_year: appliedThisYear.has(row.applicant_profile_id as string),
  }));
  const byCategory = all(
    `SELECT a.category_code, COUNT(*) AS c, COALESCE(SUM(a.amount_approved_pesewas),0) AS approved
     FROM applications a WHERE ${geo.sql}${isWelfare ? "" : phaseSql} GROUP BY a.category_code`,
    isWelfare ? geo.params : [...geo.params, ...phaseParams],
  );
  const byDistrict = all(
    `SELECT d.name AS district_name, r.name AS region_name, COUNT(*) AS applications,
            SUM(CASE WHEN a.status = 'selection' THEN 1 ELSE 0 END) AS pending_decision,
            SUM(CASE WHEN a.status IN ('disbursement','partially_fulfilled','completed') THEN 1 ELSE 0 END) AS approved,
            COALESCE(SUM(a.amount_approved_pesewas),0) AS amount_approved
     FROM applications a
     JOIN districts d ON d.id = a.district_id
     JOIN regions r ON r.id = a.region_id
     WHERE ${geo.sql}${phaseSql}
     GROUP BY d.id
     ORDER BY r.name, d.name`,
    [...geo.params, ...phaseParams],
  );
  res.json({
    applicants,
    applicationsTotal,
    rejected,
    yearStats,
    byStatus,
    byCategory,
    byDistrict,
    recent,
    statusLabels: STATUS_LABELS,
    roleView: isWelfare ? "welfare" : "default",
  });
});

adminRouter.get("/reports", requirePermission("reports.district", "reports.region", "reports.national"), (req, res) => {
  const user = req.auth!;
  const rawYear = req.query.year != null ? String(req.query.year) : String(currentApplicationYear());
  const filterAll = rawYear.toLowerCase() === "all";
  const parsed = Number(rawYear);
  const filterYear = filterAll
    ? ("all" as const)
    : Number.isFinite(parsed) && parsed > 2000
      ? Math.floor(parsed)
      : currentApplicationYear();
  const statsYear = filterAll ? null : filterYear;
  const availableYears = loadAvailableReportYears(user);
  const yearStats = loadYearDashboardStats(user, statsYear);
  const rosters = loadReportRosters(user, statsYear);
  res.json({
    filterYear,
    year: filterYear === "all" ? currentApplicationYear() : filterYear,
    availableYears,
    yearStats,
    ...rosters,
    generatedAt: now(),
    scope: user.scopes,
  });
});

adminRouter.get("/audit", requirePermission("audit.read"), (_req, res) => {
  res.json({
    activeStaff: loadActiveStaff(),
    activeWindowMinutes: ACTIVE_STAFF_WINDOW_MINUTES,
    generatedAt: now(),
  });
});

adminRouter.get("/users", requirePermission("users.manage"), (_req, res) => {
  const users = all(
    `SELECT u.id, u.email, u.status, u.last_login_at, u.created_at, p.full_name, p.photo_path
     FROM users u LEFT JOIN persons p ON p.id = u.person_id ORDER BY u.created_at DESC`,
  ).map((u) => {
    const roles = all<{ code: string }>(
      "SELECT r.code FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?",
      [u.id as string],
    ).map((r) => r.code);
    const scopes = all("SELECT scope_level, region_id, district_id FROM user_scopes WHERE user_id = ?", [u.id as string]);
    return { ...u, roles, scopes };
  });
  const roles = all("SELECT id, code, name, description FROM roles ORDER BY name");
  res.json({ users, roles });
});

adminRouter.post("/users", requirePermission("users.manage"), (req, res) => {
  const b = req.body || {};
  if (!b.email || !b.password || !b.roleCode) return res.status(400).json({ error: "Email, password and role are required" });
  if (get("SELECT id FROM users WHERE email = ?", [String(b.email).toLowerCase()])) {
    return res.status(409).json({ error: "Email already exists" });
  }
  const role = get<{ id: string }>("SELECT id FROM roles WHERE code = ?", [b.roleCode]);
  if (!role) return res.status(400).json({ error: "Unknown role" });
  const ts = now();
  const personId = newId("per");
  const userId = newId("usr");
  run(
    `INSERT INTO persons (id, full_name, date_of_birth, age, sex, phone, email, home_address, photo_path, created_at, updated_at)
     VALUES (?,?,NULL,NULL,NULL,?,?,NULL,NULL,?,?)`,
    [personId, b.fullName || b.email, b.phone || null, String(b.email).toLowerCase(), ts, ts],
  );
  run(
    `INSERT INTO users (id, email, password_hash, person_id, status, must_change_password, failed_logins, locked_until, last_login_at, created_at)
     VALUES (?,?,?,?, 'active', 0, 0, NULL, NULL, ?)`,
    [userId, String(b.email).toLowerCase(), hashPassword(String(b.password)), personId, ts],
  );
  run("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [userId, role.id]);
  run("INSERT INTO user_scopes (id, user_id, scope_level, region_id, district_id) VALUES (?,?,?,?,?)", [
    newId("scp"),
    userId,
    b.scopeLevel || "district",
    b.regionId || null,
    b.districtId || null,
  ]);
  audit({ actorUserId: req.auth!.id, action: "user.create", entityType: "user", entityId: userId, metadata: { role: b.roleCode } });
  res.status(201).json({ id: userId });
});

adminRouter.post(
  "/users/:id/profile-photo",
  requirePermission("users.manage"),
  profilePhotoUpload.single("photo"),
  (req, res) => {
    const user = get<{ id: string; person_id: string | null }>("SELECT id, person_id FROM users WHERE id = ?", [req.params.id]);
    if (!user?.person_id) return res.status(404).json({ error: "User not found" });
    if (!req.file) return res.status(400).json({ error: "Photo file is required" });
    const previous = get<{ photo_path: string | null }>("SELECT photo_path FROM persons WHERE id = ?", [user.person_id]);
    const ts = now();
    run("UPDATE persons SET photo_path = ?, updated_at = ? WHERE id = ?", [req.file.filename, ts, user.person_id]);
    if (previous?.photo_path && previous.photo_path !== req.file.filename) {
      const oldPath = path.join(uploadRoot, previous.photo_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    audit({
      actorUserId: req.auth!.id,
      action: "user.profile_photo",
      entityType: "user",
      entityId: user.id,
    });
    res.status(201).json({ photoPath: req.file.filename });
  },
);

adminRouter.patch("/users/:id", requirePermission("users.manage"), (req, res) => {
  const user = get<{ id: string; status: string }>("SELECT id, status FROM users WHERE id = ?", [req.params.id]);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (req.body.status) {
    run("UPDATE users SET status = ? WHERE id = ?", [req.body.status, user.id]);
    audit({ actorUserId: req.auth!.id, action: "user.status", entityType: "user", entityId: user.id, metadata: { status: req.body.status } });
  }
  res.json({ ok: true });
});

adminRouter.get("/settings", requirePermission("settings.manage", "reports.national"), (_req, res) => {
  const rows = all<{ key: string; value: string; updated_at: string }>("SELECT key, value, updated_at FROM system_settings");
  const parsed = Object.fromEntries(rows.map((r) => [r.key, { value: JSON.parse(r.value), updatedAt: r.updated_at }]));
  res.json(parsed);
});

adminRouter.put("/settings/:key", requirePermission("settings.manage"), (req, res) => {
  run("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", [
    req.params.key,
    JSON.stringify(req.body.value ?? req.body),
    now(),
  ]);
  audit({ actorUserId: req.auth!.id, action: "settings.update", entityType: "system_settings", entityId: req.params.key });
  res.json({ ok: true });
});

adminRouter.get("/notifications", (req, res) => {
  res.json(all("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [req.auth!.id]));
});

adminRouter.post("/notifications/:id/read", (req, res) => {
  run("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [req.params.id, req.auth!.id]);
  res.json({ ok: true });
});
