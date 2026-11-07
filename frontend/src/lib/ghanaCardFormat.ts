/** Ghana Card PIN layout: GHA-XXXXXXXXX-X (9 digits + check digit). */

const PREFIX = "GHA-";
const BODY_LEN = 9;
const CHECK_LEN = 1;
const TOTAL_DIGITS = BODY_LEN + CHECK_LEN;

/** Extract digit characters from stored or in-progress value. */
export function ghanaCardDigits(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return value
    .toUpperCase()
    .replace(/^GHA/i, "")
    .replace(/\D/g, "")
    .slice(0, TOTAL_DIGITS);
}

/** Format digits (or full/partial value) for display and storage. */
export function formatGhanaCard(value: string | null | undefined): string {
  const digits = ghanaCardDigits(value);
  if (!digits) return "";
  const body = digits.slice(0, BODY_LEN);
  const check = digits.slice(BODY_LEN, TOTAL_DIGITS);
  if (!check) {
    return body.length === BODY_LEN ? `${PREFIX}${body}-` : `${PREFIX}${body}`;
  }
  return `${PREFIX}${body}-${check}`;
}

/** Normalize API/stored values for display (adds dashes when missing). */
export function displayGhanaCard(value: string | null | undefined): string {
  const formatted = formatGhanaCard(value);
  return formatted || (value?.trim() ? value.trim().toUpperCase() : "");
}

export function isCompleteGhanaCard(value: string | null | undefined): boolean {
  return ghanaCardDigits(value).length === TOTAL_DIGITS;
}

export function ghanaCardValidationError(value: string, required: boolean): string | null {
  const digits = ghanaCardDigits(value);
  if (!digits) return required ? "Ghana Card number is required." : null;
  if (!isCompleteGhanaCard(value)) {
    return "Enter a complete Ghana Card number (GHA-XXXXXXXXX-X).";
  }
  return null;
}

export const GHANA_CARD_PLACEHOLDER = "GHA-000000000-0";
