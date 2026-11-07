import { useEffect, useRef, useState } from "react";
import { getToken } from "../lib/api";
import { PASSPORT_FORM_BOX_CLASS, PASSPORT_FORM_WRAP_CLASS } from "./RegisteredPassportPhoto";
import { Field } from "./StatusBadge";

/** Passport-style crop (width : height). */
const BOX_W = 300;
const BOX_H = 375;

type Props = {
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  label?: string;
  /** Align the clickable box within the field (use `end` beside a form column). */
  boxAlign?: "center" | "end";
  size?: "default" | "compact";
  className?: string;
  /** Edit mode: show on-file photo in the same box until a new file is chosen. */
  applicantProfileId?: string;
  photoSubject?: "caregiver" | "beneficiary";
  photoPath?: string | null;
};

function cropToPassportBox(source: CanvasImageSource, sourceW: number, sourceH: number): Promise<File | null> {
  const aspect = BOX_W / BOX_H;
  let cropW = sourceW;
  let cropH = sourceH;
  const sourceAspect = cropW / cropH;
  if (sourceAspect > aspect) {
    cropW = cropH * aspect;
  } else {
    cropH = cropW / aspect;
  }
  const sx = (sourceW - cropW) / 2;
  const sy = (sourceH - cropH) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = BOX_W;
  canvas.height = BOX_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, BOX_W, BOX_H);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(new File([blob], `passport-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function PassportPhotoField({
  file,
  onChange,
  required,
  label = "Passport photograph (caregiver)",
  boxAlign = "center",
  size = "default",
  className = "",
  applicantProfileId,
  photoSubject = "beneficiary",
  photoPath,
}: Props) {
  const boxPosition = boxAlign === "end" ? "ms-auto me-0" : "mx-auto";
  const wrapWidth = size === "compact" ? PASSPORT_FORM_WRAP_CLASS : "";
  const boxWidth =
    size === "compact"
      ? PASSPORT_FORM_BOX_CLASS
      : `w-full max-w-[11.25rem] sm:w-[11.5rem] sm:max-w-[11.5rem]`;
  const boxMaxH = size === "compact" ? "max-h-[8.5rem] sm:max-h-none" : "max-h-[14rem] sm:max-h-none";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pickError, setPickError] = useState("");
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<"idle" | "loading" | "missing" | "ready">("idle");

  const pathOnFile = photoPath?.trim() || null;
  const query = photoSubject === "caregiver" ? "?subject=caregiver" : "?subject=beneficiary";

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (file || !applicantProfileId || !pathOnFile) {
      setExistingUrl(null);
      setExistingStatus(pathOnFile && applicantProfileId && !file ? "missing" : "idle");
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setExistingStatus("loading");
    setExistingUrl(null);

    (async () => {
      const token = getToken();
      const res = await fetch(`/api/applicants/${applicantProfileId}/passport-photo${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (cancelled) return;
      if (!res.ok) {
        setExistingStatus("missing");
        return;
      }
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      setExistingUrl(objectUrl);
      setExistingStatus("ready");
    })().catch(() => {
      if (!cancelled) setExistingStatus("missing");
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [applicantProfileId, pathOnFile, query, file]);

  async function onFilePicked(list: FileList | null) {
    const picked = list?.[0];
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setPickError("Please choose an image file (JPEG or PNG).");
      return;
    }
    setPickError("");
    const objectUrl = URL.createObjectURL(picked);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const cropped = await cropToPassportBox(img, img.naturalWidth, img.naturalHeight);
      if (cropped) onChange(cropped);
      else onChange(picked);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setPickError("Could not read that image. Try another file.");
    };
    img.src = objectUrl;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function openPicker() {
    fileInputRef.current?.click();
  }

  const hasOnFilePhoto = existingStatus === "ready" && Boolean(existingUrl);
  const showEmptyPicker = !previewUrl && !hasOnFilePhoto;
  const hasExistingOnFile = Boolean(pathOnFile && applicantProfileId);
  const meetsRequired = required && (Boolean(file) || hasExistingOnFile);

  return (
    <div className={`${wrapWidth} ${className}`.trim()}>
    <Field label={label} className={size === "compact" ? "[&_label]:text-[11px]" : undefined}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        required={required && !meetsRequired ? true : undefined}
        onChange={(e) => onFilePicked(e.target.files)}
      />
      <button
        type="button"
        onClick={openPicker}
        className={`group relative block aspect-[4/5] cursor-pointer overflow-hidden rounded-md border-2 shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 ${boxWidth} ${boxMaxH} ${boxPosition} ${
          showEmptyPicker
            ? "border-navy bg-neutral-900 hover:border-teal"
            : "border-canvas bg-white hover:border-teal"
        }`}
        aria-label="Choose passport photograph file"
      >
        {previewUrl ? (
          <img src={previewUrl} alt="Passport preview" className="h-full w-full object-cover" />
        ) : hasOnFilePhoto ? (
          <img src={existingUrl!} alt="Passport photograph on file" className="h-full w-full object-cover" />
        ) : existingStatus === "loading" ? (
          <div className="flex h-full items-center justify-center px-2 text-xs text-muted">Loading…</div>
        ) : (
          <div className={`flex h-full w-full flex-col items-center justify-center gap-1 px-2 pt-4 text-center text-white/80 ${size === "compact" ? "text-[10px]" : "text-xs"}`}>
            <span className="rounded border border-white/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wide">Passport</span>
            <span>Tap to add</span>
          </div>
        )}
        <div
          className={`pointer-events-none absolute inset-3 rounded-sm border ${showEmptyPicker ? "border-white/60" : "border-slate-300/70"}`}
          aria-hidden
        />
        {showEmptyPicker && (
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-navy/80 px-2 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-white">
            Passport box
          </div>
        )}
        {(previewUrl || hasOnFilePhoto) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-navy/75 px-2 py-1 text-center text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
            Click to replace
          </div>
        )}
      </button>
      {(file || hasOnFilePhoto) && (
        <p className={`mt-2 text-xs text-muted ${boxAlign === "end" ? "text-end" : "text-center"}`}>
          {file ? (
            <>
              Click the box again to pick another file, or{" "}
              <button type="button" className="text-teal underline hover:no-underline" onClick={() => onChange(null)}>
                remove
              </button>
              .
            </>
          ) : (
            <>Click the box to upload a new photo.</>
          )}
        </p>
      )}
      {pickError && <p className="mt-2 text-sm text-danger">{pickError}</p>}
    </Field>
    </div>
  );
}
