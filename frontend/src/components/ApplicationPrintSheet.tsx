import type { RegistrationPrintPhoto } from "../lib/registrationPrint";
import {
  DottedField,
  PrintPhotoBox,
  usePassportDataUrl,
} from "./RegistrationPrintSheet";

export type ApplicationPrintSection = {
  title: string;
  rows: { label: string; value: string }[];
};

export type ApplicationPrintSnapshot = {
  documentTitle: string;
  applicationTypeLabel: string;
  applicantRef: string;
  printedAt: string;
  declaration: string;
  registrationEndorsedByName: string;
  applicationEndorsedByName: string;
  applicantSignatureMode?: "" | "signature" | "thumbprint";
  primaryPhoto: RegistrationPrintPhoto | null;
  secondaryPhoto: RegistrationPrintPhoto | null;
  sections: ApplicationPrintSection[];
};

type Props = {
  snapshot: ApplicationPrintSnapshot;
};

export function ApplicationPrintSheet({ snapshot }: Props) {
  const primaryUrl = usePassportDataUrl(snapshot.primaryPhoto);
  const secondaryUrl = usePassportDataUrl(snapshot.secondaryPhoto);
  const registrationEndorsedBy = snapshot.registrationEndorsedByName.trim();
  const applicationEndorsedBy = snapshot.applicationEndorsedByName.trim();

  const applicantSignLabel =
    snapshot.applicantSignatureMode === "thumbprint"
      ? "Applicant / caregiver thumbprint"
      : "Applicant / caregiver signature or thumbprint";

  return (
    <div className="registration-print-sheet application-print-sheet hidden text-navy print:block" aria-hidden>
      <header className="registration-print-header">
        <div className="registration-print-header-text">
          <p className="registration-print-org">National Council on Persons with Disability</p>
          <h1 className="registration-print-title">{snapshot.documentTitle}</h1>
          <p className="registration-print-subtitle">{snapshot.applicationTypeLabel}</p>
          {snapshot.declaration.trim() ? (
            <p className="registration-print-declaration">{snapshot.declaration.trim()}</p>
          ) : null}
          <div className="registration-print-ref-block">
            <p className="registration-print-ref-label">Applicant number:</p>
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
          Please attach all supporting documents. I certify that all answers recorded above are true to the best of my
          knowledge.
        </p>
        <div className="registration-print-signatures registration-print-signatures--application">
          <div className="registration-print-sign-block">
            <DottedField label="Endorsed by (application officer)" value={applicationEndorsedBy} />
            <div className="registration-print-sign-area">
              <p className="registration-print-sign-label">Signature</p>
              <div className="registration-print-sign-line" aria-hidden />
            </div>
          </div>
          <div className="registration-print-sign-block registration-print-sign-block--applicant">
            <div className="registration-print-sign-area registration-print-sign-area--spaced">
              <p className="registration-print-sign-label">{applicantSignLabel}</p>
              <div className="registration-print-sign-line" aria-hidden />
            </div>
          </div>
          {registrationEndorsedBy ? (
            <div className="registration-print-sign-block registration-print-sign-block--full">
              <DottedField label="Endorsed by (registration officer)" value={registrationEndorsedBy} />
              <div className="registration-print-sign-area">
                <p className="registration-print-sign-label">Signature</p>
                <div className="registration-print-sign-line" aria-hidden />
              </div>
            </div>
          ) : null}
        </div>
        <div className="registration-print-footer-meta">
          <p className="registration-print-footnote">Printed {snapshot.printedAt}</p>
        </div>
      </footer>
    </div>
  );
}
