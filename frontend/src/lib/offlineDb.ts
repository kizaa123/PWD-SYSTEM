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

export type PendingApplication = {
  id: string;
  createdAt: string;
  status: "pending" | "syncing" | "error";
  errorMessage?: string;
  applicantProfileId: string;
  draftApplicationId: string | null;
  patchBody: Record<string, unknown>;
  requestBody: Record<string, unknown>;
  documents: { documentType: string; fileName: string; mimeType: string; base64: string }[];
  label: string;
};

const DB_NAME = "pwd-offline";
const DB_VERSION = 2;
const STORE_REG = "pending_registrations";
const STORE_APP = "pending_applications";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_REG)) {
        db.createObjectStore(STORE_REG, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_APP)) {
        db.createObjectStore(STORE_APP, { keyPath: "id" });
      }
    };
  });
}

export async function listPendingRegistrations(): Promise<PendingRegistration[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_REG, "readonly");
    const req = tx.objectStore(STORE_REG).getAll();
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
    const tx = db.transaction(STORE_REG, "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(STORE_REG).put(entry);
  });
}

export async function updatePendingRegistration(entry: PendingRegistration) {
  return enqueuePendingRegistration(entry);
}

export async function removePendingRegistration(id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_REG, "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(STORE_REG).delete(id);
  });
}

export async function listPendingApplications(): Promise<PendingApplication[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APP, "readonly");
    const req = tx.objectStore(STORE_APP).getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const rows = (req.result as PendingApplication[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(rows);
    };
  });
}

export async function countPendingApplications(): Promise<number> {
  const rows = await listPendingApplications();
  return rows.filter((r) => r.status === "pending" || r.status === "error").length;
}

export async function enqueuePendingApplication(entry: PendingApplication) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_APP, "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(STORE_APP).put(entry);
  });
}

export async function updatePendingApplication(entry: PendingApplication) {
  return enqueuePendingApplication(entry);
}

export async function removePendingApplication(id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_APP, "readwrite");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    tx.objectStore(STORE_APP).delete(id);
  });
}

export async function fileToPayload(file: File): Promise<{ fileName: string; mimeType: string; base64: string }> {
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
  return { fileName: file.name || "document", mimeType: file.type || "application/octet-stream", base64 };
}

export function payloadToFile(payload: { fileName: string; mimeType: string; base64: string }): File {
  const bin = atob(payload.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], payload.fileName, { type: payload.mimeType });
}

export async function fileToPhotoPayload(file: File): Promise<NonNullable<PendingRegistration["photo"]>> {
  return fileToPayload(file);
}

export function photoPayloadToFile(photo: NonNullable<PendingRegistration["photo"]>): File {
  return payloadToFile(photo);
}
