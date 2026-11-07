import { useEffect, useState } from "react";
import { getToken } from "../lib/api";
import type { RegistrationPrintPhoto, RegistrationPrintSnapshot } from "../lib/registrationPrint";

type Props = {
  snapshot: RegistrationPrintSnapshot;
};

export function usePassportDataUrl(photo: RegistrationPrintPhoto | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photo?.photoPath?.trim()) {
      setDataUrl(null);
      return;
    }

    let cancelled = false;
    const query = photo.subject === "caregiver" ? "?subject=caregiver" : "?subject=beneficiary";

    (async () => {
      const token = getToken();
      const res = await fetch(`/api/applicants/${photo.applicantProfileId}/passport-photo${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (cancelled) return;
      if (!res.ok) {
        setDataUrl(null);
        return;
      }
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        if (!cancelled && typeof reader.result === "string") setDataUrl(reader.result);
      };
      reader.readAsDataURL(blob);
    })().catch(() => {
      if (!cancelled) setDataUrl(null);
    });

    return () => {
      cancelled = true;
    };
  }, [photo?.applicantProfileId, photo?.photoPath, photo?.subject]);

  return dataUrl;
}

export function DottedField({ label, value }: { label: string; value: string }) {
  const filled = Boolean(value?.trim());
  return (
    <div className="registration-print-dotted-row">
      <span className="registration-print-dotted-label">{label} :</span>
      <span className="registration-print-dotted-line">
        {filled ? <span className="registration-print-dotted-text">{value.trim()}</span> : null}
      </span>
    </div>
  );
}

export function PrintPhotoBox({ photo, dataUrl }: { photo: RegistrationPrintPhoto; dataUrl: string | null }) {
  return (
    <figure className="registration-print-photo">
      <div className="registration-print-photo-frame">
        {dataUrl ? (
          <img src={dataUrl} alt="" className="registration-print-photo-img" />
        ) : (
          <div className="registration-print-photo-placeholder">Photo not on file</div>
        )}
      </div>
      <figcaption className="registration-print-photo-caption">{photo.caption}</figcaption>
    </figure>
  );
}

export function RegistrationPrintSheet({ snapshot }: Props) {
  const primaryUrl = usePassportDataUrl(snapshot.primaryPhoto);
  const secondaryUrl = usePassportDataUrl(snapshot.secondaryPhoto);

  return (
    <div className="registration-print-sheet hidden text-navy print:block" aria-hidden>
      <header className="registration-print-header">
        <div className="registration-print-header-text">
          <p className="registration-print-org">National Council on Persons with Disability</p>
          <h1 className="registration-print-title">{snapshot.documentTitle}</h1>
          <p className="registration-print-subtitle">{snapshot.registrationTypeLabel}</p>
          <div className="registration-print-ref-block">
            <p className="registration-print-ref-label">Registration reference:</p>
            <p className="registration-print-ref-value">{snapshot.applicantRef}</p>
          </div>
        </div>
        <div className="registration-print-photos">
          {snapshot.primaryPhoto ? (
            <PrintPhotoBox photo={snapshot.primaryPhoto} dataUrl={primaryUrl} />
          ) : null}
          {snapshot.secondaryPhoto ? (
            <PrintPhotoBox photo={snapshot.secondaryPhoto} dataUrl={secondaryUrl} />
          ) : null}
        </div>
      </header>

      <div className="registration-print-body">
        {snapshot.sections.map((section) => (
          <section key={section.title} className="registration-print-section">
            <h2 className="registration-print-section-title">{section.title}</h2>
            <div className="registration-print-fields">
              {section.rows.map((r) => (
                <DottedField key={`${section.title}-${r.label}`} label={r.label} value={r.value} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="registration-print-footer">
        <p className="registration-print-certify">
          I certify that the information recorded above is true to the best of my knowledge.
        </p>
        <div className="registration-print-signatures">
          <div className="registration-print-sign-block">
            <DottedField label="Endorsed by (registration officer)" value={snapshot.endorsedBy} />
            <div className="registration-print-sign-area">
              <p className="registration-print-sign-label">Signature</p>
              <div className="registration-print-sign-line" aria-hidden />
            </div>
          </div>
          <div className="registration-print-sign-block registration-print-sign-block--applicant">
            <div className="registration-print-sign-area registration-print-sign-area--spaced">
              <p className="registration-print-sign-label">Applicant / caregiver signature or thumbprint</p>
              <div className="registration-print-sign-line" aria-hidden />
            </div>
          </div>
        </div>
        <div className="registration-print-footer-meta">
          <p className="registration-print-footnote">Printed {snapshot.printedAt}</p>
        </div>
      </footer>
    </div>
  );
}
