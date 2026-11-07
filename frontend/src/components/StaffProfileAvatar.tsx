import { useEffect, useState } from "react";
import { getToken } from "../lib/api";

type Props = {
  name: string;
  photoPath?: string | null;
  className?: string;
};

export function StaffProfileAvatar({ name, photoPath, className = "h-11 w-11" }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const initial = name.trim().slice(0, 1).toUpperCase() || "?";

  useEffect(() => {
    if (!photoPath?.trim()) {
      setSrc(null);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      const token = getToken();
      const res = await fetch("/api/auth/profile-photo", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (cancelled) return;
      if (!res.ok) {
        setSrc(null);
        return;
      }
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    })().catch(() => {
      if (!cancelled) setSrc(null);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoPath]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`${className} shrink-0 rounded-full border-2 border-white/25 object-cover shadow-md ring-2 ring-teal/40`}
      />
    );
  }

  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full border-2 border-white/20 bg-gradient-to-br from-teal to-teal/70 text-sm font-bold text-white shadow-md`}
      aria-hidden
    >
      {initial}
    </span>
  );
}
