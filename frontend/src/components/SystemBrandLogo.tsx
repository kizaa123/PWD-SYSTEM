import { useState } from "react";

/** Replace logo: frontend/public/system-logo.jpg or system-logo.png — see system-logo.README.txt */
export const SYSTEM_LOGO_SRC = "/system-logo.jpg";
const LOGO_FALLBACKS = ["/system-logo.png", "/ghana-coat-of-arms.png"];

export function SystemLogoImage({
  className = "h-full w-full scale-110 object-cover",
  alt = "System logo",
}: {
  className?: string;
  alt?: string;
}) {
  const [src, setSrc] = useState(SYSTEM_LOGO_SRC);

  function onLogoError() {
    const idx = LOGO_FALLBACKS.indexOf(src);
    if (idx >= 0 && idx < LOGO_FALLBACKS.length - 1) setSrc(LOGO_FALLBACKS[idx + 1]);
    else if (src !== LOGO_FALLBACKS[LOGO_FALLBACKS.length - 1]) setSrc(LOGO_FALLBACKS[LOGO_FALLBACKS.length - 1]);
  }

  return <img src={src} alt={alt} className={className} onError={onLogoError} />;
}

export function SystemBrandLogo() {
  return (
    <div className="flex items-center gap-3.5">
      <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-[50%] border-2 border-white/20 bg-white shadow-md ring-2 ring-teal/30">
        <SystemLogoImage alt="System logo" />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="text-[15px] font-bold tracking-tight text-white">PWD Support</div>
        <div className="text-[11px] font-medium text-white/70">Management System</div>
      </div>
    </div>
  );
}
