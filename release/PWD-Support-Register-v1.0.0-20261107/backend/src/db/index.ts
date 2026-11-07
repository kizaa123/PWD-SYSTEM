import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_SQL } from "./schema.ts";
import { applyOperatingPolicy } from "./policy.ts";
import { seedIfEmpty } from "./seed.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "../../data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "pwd.sqlite");
export const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON");
db.exec(SCHEMA_SQL);
seedIfEmpty(db);
applyOperatingPolicy(db);

export type SqlValue = string | number | bigint | null | Uint8Array;

export function all<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, params: SqlValue[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, params: SqlValue[] = []) {
  return db.prepare(sql).run(...params);
}

export function now(): string {
  return new Date().toISOString();
}
