import path from "node:path";
import { fileURLToPath } from "node:url";

/** `backend/` directory (this file lives in `backend/src/lib/`). */
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** SQLite and other data files (`PWD_DATA_DIR` on Render/Fly persistent disk). */
export function dataDir(): string {
  const fromEnv = process.env.PWD_DATA_DIR?.trim();
  return fromEnv ? path.resolve(fromEnv) : path.join(backendRoot, "data");
}

/** Passport photos and document uploads. */
export function uploadsDir(): string {
  const fromEnv = process.env.PWD_UPLOADS_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  if (process.env.PWD_DATA_DIR?.trim()) return path.join(dataDir(), "uploads");
  return path.join(backendRoot, "uploads");
}
