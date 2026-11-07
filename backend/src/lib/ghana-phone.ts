export function normalizeGhanaPhone(value: string): string {
  let d = value.replace(/\D/g, "");
  if (d.startsWith("233") && d.length >= 12) {
    d = `0${d.slice(3, 12)}`;
  } else if (d.startsWith("233") && d.length > 3) {
    d = `0${d.slice(3)}`;
  }
  return d.slice(0, 10);
}

export function isValidGhanaPhone(value: string): boolean {
  const d = normalizeGhanaPhone(value);
  if (d.length !== 10 || !d.startsWith("0")) return false;
  return /^0[235][0-9]{8}$/.test(d);
}

export function resolveGhanaPhone(
  value: unknown,
  label: string,
  required: boolean,
): { error: string } | { value: string | null } {
  if (value == null || String(value).trim() === "") {
    if (required) return { error: `${label} is required.` };
    return { value: null };
  }
  const raw = String(value);
  if (!isValidGhanaPhone(raw)) {
    return { error: `${label} must be a valid Ghana mobile number (10 digits, e.g. 0244123456).` };
  }
  return { value: normalizeGhanaPhone(raw) };
}
