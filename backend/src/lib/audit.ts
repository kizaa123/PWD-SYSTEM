import { db, now } from "../db/index.ts";
import { newId } from "./crypto.ts";

export function audit(opts: {
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  outcome?: string;
  metadata?: unknown;
  ip?: string | null;
}) {
  db.prepare(
    `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, outcome, metadata, ip_address, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    newId("aud"),
    opts.actorUserId ?? null,
    opts.action,
    opts.entityType ?? null,
    opts.entityId ?? null,
    opts.outcome ?? "success",
    opts.metadata ? JSON.stringify(opts.metadata) : null,
    opts.ip ?? null,
    now(),
  );
}

export function notify(userId: string | null, applicationId: string | null, title: string, body: string) {
  if (!userId) return;
  db.prepare(
    `INSERT INTO notifications (id, user_id, application_id, channel, title, body, is_read, created_at)
     VALUES (?,?,?,?,?,?,0,?)`,
  ).run(newId("ntf"), userId, applicationId, "in_app", title, body, now());
}
