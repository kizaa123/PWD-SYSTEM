/** Ghana mobile contact: 10 digits starting with 0 (02X / 03X / 05X). */

export function ghanaPhoneDigits(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  let d = value.replace(/\D/g, "");
  if (d.startsWith("233") && d.length >= 12) {
    d = `0${d.slice(3, 12)}`;
  } else if (d.startsWith("233") && d.length > 3) {
    d = `0${d.slice(3)}`;
  }
  if (d.length > 10) d = d.slice(0, 10);
  return d;
}

export function formatGhanaPhone(value: string | null | undefined): string {
  const d = ghanaPhoneDigits(value);
  if (!d) return "";
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export function isValidGhanaPhone(value: string | null | undefined): boolean {
  const d = ghanaPhoneDigits(value);
  if (d.length !== 10 || !d.startsWith("0")) return false;
  return /^0[235][0-9]{8}$/.test(d);
}

export const GHANA_PHONE_PLACEHOLDER = "0XX XXX XXXX";

export function phoneValidationError(value: string, required: boolean): string | null {
  const d = ghanaPhoneDigits(value);
  if (!d) return required ? "Contact phone number is required." : null;
  if (!isValidGhanaPhone(d)) {
    return "Enter a valid Ghana mobile number (10 digits, e.g. 024 412 3456).";
  }
  return null;
}
