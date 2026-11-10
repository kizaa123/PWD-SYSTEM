import { CATEGORY_LABELS } from "../lib/api";
import type { SupportTypeCategoryGroup } from "./SupportTypeBreakdownPanel";
import { SupportTypeDotSummary } from "./SupportTypeDotSummary";

/** Shared print block: category summaries + name rosters by support type. */
export function SupportTypePrintSections({ groups }: { groups: SupportTypeCategoryGroup[] }) {
  if (!groups.length) return null;

  return (
    <section className="reports-print-section">
      <h2 className="reports-print-section-title">Support types and applicant lists</h2>
      <p className="reports-print-muted">
        Qualified applicants only (office “not qualified” excluded). Summary counts first; name lists follow each broad
        category.
      </p>
      {groups.map((group) => (
        <article key={group.category_code} className="reports-print-support-category reports-print-type-category">
          <h3 className="reports-print-subtitle">
            {CATEGORY_LABELS[group.category_code] || group.category_name}
            <span className="reports-print-subtitle-meta">
              {" "}
              — {group.applicants} applicant{group.applicants === 1 ? "" : "s"}
            </span>
          </h3>
          <SupportTypeDotSummary lines={group.lines} variant="print" />
          <div className="reports-print-type-rosters">
          {group.lines.map((line) =>
            line.people.length > 0 ? (
              <div key={`${line.segment_key}-roster`} className="reports-print-roster-block reports-print-type-block">
                <h4 className="reports-print-roster-heading">
                  {line.label}
                  <span className="reports-print-roster-count">
                    {" "}
                    ({line.applicants} applicant{line.applicants === 1 ? "" : "s"})
                  </span>
                </h4>
                <table className="reports-print-table reports-print-roster">
                  <thead>
                    <tr>
                      <th className="reports-print-th">Reg. no.</th>
                      <th className="reports-print-th">Name</th>
                      <th className="reports-print-th">PWD (caregiver reg.)</th>
                      <th className="reports-print-th">App. ref.</th>
                      <th className="reports-print-th">Phone</th>
                      <th className="reports-print-th">Community</th>
                    </tr>
                  </thead>
                  <tbody>
                    {line.people.map((p) => (
                      <tr key={`${p.application_reference}-${p.applicant_ref}`}>
                        <td className="reports-print-td reports-print-td-mono">{p.applicant_ref}</td>
                        <td className="reports-print-td">{p.display_name}</td>
                        <td className="reports-print-td">
                          {p.registration_type === "caregiver" && p.beneficiary_name ? p.beneficiary_name : "—"}
                        </td>
                        <td className="reports-print-td reports-print-td-mono">{p.application_reference}</td>
                        <td className="reports-print-td">{p.phone || "—"}</td>
                        <td className="reports-print-td">{p.community || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null,
          )}
          </div>
        </article>
      ))}
    </section>
  );
}
