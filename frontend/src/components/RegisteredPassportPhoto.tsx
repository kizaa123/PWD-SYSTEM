import { useEffect, useState } from "react";
import { getToken } from "../lib/api";

/**
 * One desktop passport width everywhere (registration form, modals, apply).
 * 4:5 box ≈ 11.5rem wide on sm+; smaller on mobile.
 */
export const PASSPORT_PHOTO_PRIMARY_CLASS = "w-[4.25rem] sm:w-[11.5rem]";
export const PASSPORT_PHOTO_SECONDARY_CLASS = "w-[3.75rem] sm:w-[9.5rem]";
export const PASSPORT_PHOTO_BOX_PRIMARY = "max-w-[4.25rem] sm:max-w-[11.5rem]";
export const PASSPORT_PHOTO_BOX_SECONDARY = "max-w-[3.75rem] sm:max-w-[9.5rem]";
/** Registration / edit form header (slightly wider on phone). */
export const PASSPORT_FORM_WRAP_CLASS = "w-[6.75rem] shrink-0 sm:w-[11.5rem]";
export const PASSPORT_FORM_BOX_CLASS = "w-[6.75rem] sm:w-[11.5rem]";

type Props = {
  applicantProfileId: string;
  /** Stored filename from registration (`persons.photo_path`). */
  photoPath?: string | null;
  /** @deprecated Use photoPath. When false, skip fetch. */
  hasPhoto?: boolean;
  /** Caregiver registrations store the passport on the linked caregiver person. */
  subject?: "caregiver" | "beneficiary" | "auto";
  className?: string;
  size?: "xs" | "small" | "medium" | "default" | "large";
  align?: "center" | "end";
  /** When false, hide the "Passport" caption (e.g. compact modal header). Default true. */
  showLabel?: boolean;
  /** Overrides the inner box max-width from `size` (e.g. responsive `max-w-[4.5rem] sm:max-w-[13.5rem]`). */
  boxMaxWidthClass?: string;
};

export function RegisteredPassportPhoto({
  applicantProfileId,
  photoPath,
  hasPhoto,
  subject = "auto",
  className = "",
  size = "default",
  align = "center",
  showLabel = true,
  boxMaxWidthClass,
}: Props) {
  const maxWidth =
    size === "large"
      ? "max-w-[220px]"
      : size === "medium"
        ? "max-w-[180px]"
        : size === "small"
          ? "max-w-[120px]"
          : size === "xs"
            ? "max-w-[6.75rem]"
            : "max-w-[160px]";
  const boxMax = boxMaxWidthClass ?? maxWidth;
  const alignClass = align === "end" ? "ms-auto me-0" : "mx-auto";

  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "missing" | "ready">("idle");

  const query =
    subject === "caregiver" ? "?subject=caregiver" : subject === "beneficiary" ? "?subject=beneficiary" : "";

  const pathOnFile = photoPath?.trim() || null;

  useEffect(() => {
    if (!applicantProfileId) {
      setSrc(null);
      setStatus("missing");
      return;
    }
    const shouldFetch = Boolean(pathOnFile) || hasPhoto === true;
    if (!shouldFetch) {
      setSrc(null);
      setStatus("missing");
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setStatus("loading");
    setSrc(null);

    (async () => {
      const token = getToken();
      const res = await fetch(`/api/applicants/${applicantProfileId}/passport-photo${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (cancelled) return;
      if (!res.ok) {
        setStatus("missing");
        return;
      }
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
      setStatus("ready");
    })().catch(() => {
      if (!cancelled) setStatus("missing");
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [applicantProfileId, pathOnFile, hasPhoto, query]);

  return (
    <div className={`${className}`}>
      {showLabel ? (
        <p
          className={`font-medium text-muted ${size === "xs" ? "text-[10px]" : "text-xs"} ${align === "end" ? "text-end" : "text-center"}`}
        >
          Passport
        </p>
      ) : null}
      <div
        className={`relative ${showLabel ? "mt-2" : ""} aspect-[4/5] w-full overflow-hidden rounded-md border border-canvas bg-white shadow-sm ${boxMax} ${alignClass}`}
        title={pathOnFile ? `File: ${pathOnFile}` : undefined}
      >
        {status === "loading" && (
          <div className="flex h-full items-center justify-center px-2 text-xs text-muted">Loading…</div>
        )}
        {status === "missing" && (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-muted">
            <span className="text-[10px] uppercase tracking-wide text-muted/80">Passport box</span>
            <span>Not on file</span>
          </div>
        )}
        {status === "ready" && src && <img src={src} alt="Passport photograph" className="h-full w-full object-cover" />}
      </div>
    </div>
  );
}
