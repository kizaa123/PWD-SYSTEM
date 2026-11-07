import { getToken } from "./api";

export type ApplicationDocumentRow = {
  id: string;
  document_type: string;
  original_name: string;
  mime_type?: string | null;
  is_medical?: number;
};

const SUPPORTING_DOC_TYPES = new Set([
  "medical_receipt",
  "medical_document",
  "admission_letter",
  "school_invoice",
  "prescription",
]);

export function applicationDocumentFileUrl(documentId: string): string {
  const token = getToken();
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return `/api/applications/documents/${documentId}/file${q}`;
}

/** Open the file in a new browser tab (PDFs and images display inline when supported). */
export function openApplicationDocument(documentId: string): void {
  window.open(applicationDocumentFileUrl(documentId), "_blank", "noopener,noreferrer");
}

/** Open in a new tab, then trigger the browser print dialog when the tab loads. */
export function printApplicationDocument(documentId: string): void {
  const url = applicationDocumentFileUrl(documentId);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) return;
  const tryPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* PDF viewer may block print until ready — user can print from the tab */
    }
  };
  win.addEventListener("load", () => setTimeout(tryPrint, 600));
}

export function applicationDocumentTypeLabel(documentType: string): string {
  const labels: Record<string, string> = {
    medical_receipt: "Hospital medical document",
    medical_document: "Medical document",
    admission_letter: "Letter from school",
    school_invoice: "School invoice",
    prescription: "Prescription",
    passport_photo: "Passport photo",
    ghana_card: "Ghana Card",
  };
  return labels[documentType] || documentType.replaceAll("_", " ");
}

/** Documents uploaded during apply (health, education, etc.), not registration passport copies. */
export function supportingApplicationDocuments(docs: ApplicationDocumentRow[] | undefined): ApplicationDocumentRow[] {
  if (!docs?.length) return [];
  return docs.filter(
    (d) =>
      d.is_medical ||
      SUPPORTING_DOC_TYPES.has(d.document_type) ||
      d.document_type.includes("medical") ||
      d.document_type.includes("school") ||
      d.document_type.includes("admission"),
  );
}
