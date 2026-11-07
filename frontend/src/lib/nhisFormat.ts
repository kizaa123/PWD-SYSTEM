/** Ghana NHIS membership number: 8 digits printed on the NHIS card. */

export const NHIS_DIGIT_LEN = 8;

export function nhisDigits(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return value.replace(/\D/g, "").slice(0, NHIS_DIGIT_LEN);
}

export function formatNhis(value: string | null | undefined): string {
  const digits = nhisDigits(value);
  if (!digits) return "";
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)} ${digits.slice(4)}`;
}

export function displayNhis(value: string | null | undefined): string {
  return formatNhis(value) || (value?.trim() ? nhisDigits(value) : "");
}

export function isCompleteNhis(value: string | null | undefined): boolean {
  return nhisDigits(value).length === NHIS_DIGIT_LEN;
}

export function nhisValidationError(value: string, required: boolean): string | null {
  const digits = nhisDigits(value);
  if (!digits) return required ? "NHIS membership number is required." : null;
  if (!isCompleteNhis(value)) {
    return "Enter a complete NHIS membership number (8 digits).";
  }
  return null;
}

export const NHIS_PLACEHOLDER = "1234 5678";
