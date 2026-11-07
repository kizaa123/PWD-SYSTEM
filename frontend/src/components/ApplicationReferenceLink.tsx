import { useState } from "react";
import { ApplicationViewModal } from "./ApplicationViewModal";
import { referenceNumberClass } from "./StatusBadge";

type Props = {
  applicationId: string;
  children: React.ReactNode;
  className?: string;
};

/** Opens the read-only application record (same layout as the apply form). */
export function ApplicationReferenceLink({ applicationId, children, className = "" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={`${referenceNumberClass} font-mono text-xs hover:underline ${className}`.trim()}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && <ApplicationViewModal applicationId={applicationId} onClose={() => setOpen(false)} />}
    </>
  );
}
