export type PendingRegistration = {
  id: string;
  createdAt: string;
  status: "pending" | "syncing" | "error" | "duplicate";
  errorMessage?: string;
  serverApplicantId?: string;
  registrationType: "pwd" | "caregiver";
  body: Record<string, unknown>;
  photo?: { fileName: string; mimeType: string; base64: string };
  photoForCaregiver?: boolean;
  beneficiaryLabel: string;
};

const DB_NAME = "pwd-offline";
const DB_VERSION = 1;
const STORE = "pending_registrations";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

export async function listPendingRegistrations(): Promise<PendingRegistration[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const rows = (req.result as PendingRegistration[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(rows);
    };
  });
}

export async function countPendingRegistrations(): Promise<number> {
  const all = await listPendingRegistrations();
  return all.filter((r) => r.status === "pending" || r.status === "error").length;
}

export async function enqueuePendingRegistration(entry: PendingRegistration) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(STORE).put(entry);
  });
}

export async function updatePendingRegistration(entry: PendingRegistration) {
  return enqueuePendingRegistration(entry);
}

export async function removePendingRegistration(id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(STORE).delete(id);
  });
}

export async function fileToPhotoPayload(file: File): Promise<PendingRegistration["photo"]> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return { fileName: file.name || "passport.jpg", mimeType: file.type || "image/jpeg", base64 };
}

export function photoPayloadToFile(photo: NonNullable<PendingRegistration["photo"]>): File {
  const bin = atob(photo.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], photo.fileName, { type: photo.mimeType });
}
