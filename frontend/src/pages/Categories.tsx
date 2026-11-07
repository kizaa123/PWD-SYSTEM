import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { PageTitle } from "../components/PageTitle";

type Category = { code: string; name: string; description: string; required_documents: string; is_active: number };

export function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  useEffect(() => {
    api<{ categories: Category[] }>("/api/auth/lookups").then((d) => setRows(d.categories)).catch(() => setRows([]));
  }, []);

  return (
    <div>
      <PageTitle title="Support Categories" subtitle="One category per application. Passport photograph and Ghana Card are mandatory. Other documents for a support type are supplementary and do not stop submission." />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((c) => {
          const docs = safeDocs(c.required_documents);
          return (
            <article key={c.code} className="rounded-2xl bg-surface p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-navy">{c.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.is_active ? "bg-success/10 text-success" : "bg-muted/10 text-muted"}`}>
                  {c.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">{c.description}</p>
              <DocumentGroup label="Mandatory" docs={docs.mandatory} />
              <DocumentGroup label="Supplementary — optional" docs={docs.supplementary} />
            </article>
          );
        })}
      </div>
    </div>
  );
}

function DocumentGroup({ label, docs }: { label: string; docs: string[] }) {
  if (!docs.length) return null;
  return (
    <div className="mt-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {docs.map((doc) => (
          <li key={doc} className="rounded-full bg-canvas px-2.5 py-1 text-xs text-navy">{doc.replaceAll("_", " ")}</li>
        ))}
      </ul>
    </div>
  );
}

function safeDocs(value: string): { mandatory: string[]; supplementary: string[] } {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const names = parsed.map(String);
      return {
        mandatory: names.filter((name) => name === "passport_photo" || name === "ghana_card"),
        supplementary: names.filter((name) => name !== "passport_photo" && name !== "ghana_card"),
      };
    }
    return {
      mandatory: Array.isArray(parsed?.mandatory) ? parsed.mandatory.map(String) : [],
      supplementary: Array.isArray(parsed?.supplementary) ? parsed.supplementary.map(String) : [],
    };
  } catch {
    return { mandatory: [], supplementary: [] };
  }
}
