import { all, now, run } from "../db/index.ts";

const TOUCH_MS = 30_000;
const lastTouch = new Map<string, number>();

export const ACTIVE_STAFF_WINDOW_MINUTES = 5;

export function touchUserPresence(userId: string) {
  const t = Date.now();
  const prev = lastTouch.get(userId) ?? 0;
  if (t - prev < TOUCH_MS) return;
  lastTouch.set(userId, t);
  run("UPDATE users SET last_seen_at = ? WHERE id = ?", [now(), userId]);
}

export type ActiveStaffRow = {
  id: string;
  email: string;
  full_name: string | null;
  last_seen_at: string;
  last_login_at: string | null;
  roles: string[];
};

export function loadActiveStaff(): ActiveStaffRow[] {
  const cutoff = new Date(Date.now() - ACTIVE_STAFF_WINDOW_MINUTES * 60_000).toISOString();
  const rows = all<{
    id: string;
    email: string;
    full_name: string | null;
    last_seen_at: string;
    last_login_at: string | null;
    roles_csv: string | null;
  }>(
    `SELECT DISTINCT u.id, u.email, u.last_seen_at, u.last_login_at, p.full_name,
            (SELECT GROUP_CONCAT(r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles_csv
     FROM users u
     LEFT JOIN persons p ON p.id = u.person_id
     WHERE u.status = 'active'
       AND u.last_seen_at IS NOT NULL
       AND u.last_seen_at >= ?
       AND EXISTS (
         SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = u.id AND r.code NOT IN ('applicant', 'caregiver')
       )
     ORDER BY u.last_seen_at DESC`,
    [cutoff],
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    full_name: r.full_name,
    last_seen_at: r.last_seen_at,
    last_login_at: r.last_login_at,
    roles: r.roles_csv ? r.roles_csv.split(",").filter(Boolean) : [],
  }));
}
