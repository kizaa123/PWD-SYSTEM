import { getToken, uploadApplicantPassportPhoto } from "./api";
import { apiReachable } from "./connection";
import {
  listPendingRegistrations,
  photoPayloadToFile,
  removePendingRegistration,
  updatePendingRegistration,
  type PendingRegistration,
} from "./offlineDb";

type SyncListeners = Set<() => void>;

const listeners: SyncListeners = new Set();
let syncing = false;

export function onRegistrationSyncChange(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore */
    }
  });
}

export function notifyRegistrationQueueChanged() {
  notify();
}

async function postRegistration(body: Record<string, unknown>) {
  const token = getToken();
  if (!token) throw new Error("Sign in while online before syncing offline registrations.");
  const res = await fetch("/api/applicants", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || res.statusText);
    (err as Error & { status?: number; details?: unknown }).status = res.status;
    (err as Error & { details?: unknown }).details = data;
    throw err;
  }
  return data as { id: string };
}

async function syncOne(row: PendingRegistration): Promise<"done" | "retry" | "duplicate"> {
  const working: PendingRegistration = { ...row, status: "syncing" };
  await updatePendingRegistration(working);
  try {
    const result = await postRegistration(working.body);
    if (working.photo) {
      const file = photoPayloadToFile(working.photo);
      await uploadApplicantPassportPhoto(result.id, file, {
        forCaregiver: working.photoForCaregiver ?? working.registrationType === "caregiver",
      });
    }
    await removePendingRegistration(working.id);
    return "done";
  } catch (err) {
    const status = (err as Error & { status?: number }).status;
    const details = (err as Error & { details?: Record<string, unknown> }).details;
    if (status === 409 && details?.existing) {
      const failed: PendingRegistration = {
        ...working,
        status: "duplicate",
        serverApplicantId: String(details.applicantId || ""),
        errorMessage: String(details.error || "Already registered on the server."),
      };
      await updatePendingRegistration(failed);
      return "duplicate";
    }
    const failed: PendingRegistration = {
      ...working,
      status: "error",
      errorMessage: err instanceof Error ? err.message : "Sync failed",
    };
    await updatePendingRegistration(failed);
    return "retry";
  }
}

export async function flushPendingRegistrations(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  if (!getToken()) return { synced: 0, failed: 0 };
  const reachable = await apiReachable();
  if (!reachable) return { synced: 0, failed: 0 };

  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const rows = await listPendingRegistrations();
    for (const row of rows) {
      if (row.status !== "pending" && row.status !== "error") continue;
      const outcome = await syncOne(row);
      if (outcome === "done") synced += 1;
      else if (outcome === "retry") failed += 1;
    }
  } finally {
    syncing = false;
    notify();
  }
  return { synced, failed };
}

export async function getSyncSummary() {
  const rows = await listPendingRegistrations();
  const pending = rows.filter((r) => r.status === "pending").length;
  const errors = rows.filter((r) => r.status === "error").length;
  const duplicates = rows.filter((r) => r.status === "duplicate").length;
  return { pending, errors, duplicates, rows };
}
