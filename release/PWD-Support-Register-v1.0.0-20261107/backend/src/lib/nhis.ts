import { normalizeIdentifier } from "./crypto.ts";

export const NHIS_DIGIT_LEN = 8;

export function normalizeNhis(value: string): string {
  return normalizeIdentifier(value).replace(/\D/g, "").slice(0, NHIS_DIGIT_LEN);
}

export function isValidNhis(value: string): boolean {
  const digits = normalizeNhis(value);
  return digits.length === NHIS_DIGIT_LEN;
}

export function resolveNhis(
  value: unknown,
  label: string,
  required: boolean,
): { error: string } | { value: string | null } {
  if (value == null || String(value).trim() === "") {
    if (required) return { error: `${label} is required.` };
    return { value: null };
  }
  const raw = String(value);
  if (!isValidNhis(raw)) {
    return { error: `${label} must be an 8-digit NHIS membership number (as printed on the NHIS card).` };
  }
  return { value: normalizeNhis(raw) };
}
