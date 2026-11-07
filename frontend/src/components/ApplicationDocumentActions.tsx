import {
  applicationDocumentTypeLabel,
  openApplicationDocument,
  printApplicationDocument,
  type ApplicationDocumentRow,
} from "../lib/applicationDocuments";

type Props = {
  documents: ApplicationDocumentRow[];
  title?: string;
  className?: string;
};

export function ApplicationDocumentActions({
  documents,
  title = "Documents submitted with this application",
  className = "",
}: Props) {
  if (documents.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`.trim()}>
      <h4 className="text-sm font-bold text-navy">{title}</h4>
      <ul className="space-y-2">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex flex-col gap-2 rounded-lg border border-canvas bg-canvas/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted">{applicationDocumentTypeLabel(doc.document_type)}</div>
              <div className="truncate text-sm font-medium text-navy" title={doc.original_name}>
                {doc.original_name}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-teal/10 px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal/20"
                onClick={() => openApplicationDocument(doc.id)}
              >
                Open file
              </button>
              <button
                type="button"
                className="rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-canvas"
                onClick={() => printApplicationDocument(doc.id)}
              >
                Print
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Opens in a new tab. PDFs and images can be read there; use Print for a paper copy.</p>
    </div>
  );
}
