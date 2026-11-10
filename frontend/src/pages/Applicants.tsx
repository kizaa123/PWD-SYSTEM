import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { readApplicantsListCache, writeApplicantsListCache } from "../lib/applicantsCache";
import { Button, ReferenceNumber, inputClass } from "../components/StatusBadge";
import { PageTitle } from "../components/PageTitle";
import { ApplicantViewModal } from "../components/ApplicantViewModal";
import { useAuth } from "../lib/auth";
import { formatAppDateFromIso } from "../lib/dateFormat";
import {
  registrationListDisabilityLabel,
  registrationListPrimaryCommunity,
  registrationListPrimaryGhanaCard,
  registrationListPrimaryName,
  registrationListPrimaryPhone,
  type RegistrationListRow,
} from "../lib/registrationListDisplay";

type Row = RegistrationListRow & {
  id: string;
  applicant_ref: string;
  created_at: string;
  registration_source: string;
  registered_by_name: string | null;
};

function endorsedByLabel(row: Row) {
  if (row.registered_by_name?.trim()) return row.registered_by_name.trim();
  if (row.registration_source === "self") return "Self-registered (legacy)";
  return "—";
}

export function ApplicantsPage() {
  const { has } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewId, setViewId] = useState<string | null>(searchParams.get("view"));
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    const fromUrl = searchParams.get("view");
    if (fromUrl) setViewId(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    const cached = !q.trim() ? readApplicantsListCache<Row>() : null;
    if (cached) setRows(cached);
    api<Row[]>(`/api/applicants?q=${encodeURIComponent(q)}`)
      .then((data) => {
        if (!q.trim()) writeApplicantsListCache(data);
        setRows(data);
      })
      .catch(() => {
        if (cached) setRows(cached);
        else setRows([]);
      });
  }, [q, listKey]);

  function closeModal() {
    setViewId(null);
    if (searchParams.get("view")) {
      const next = new URLSearchParams(searchParams);
      next.delete("view");
      setSearchParams(next, { replace: true });
    }
  }

  function refreshList() {
    setListKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      <PageTitle title="Registration" subtitle="Permanent register of persons with disability and caregivers. Register once; use View for the full dossier, Edit to update biodata, or Apply when the person has not yet applied this year.">
        {has("applicants.create") && (
          <Link to="/applicants/new"><Button tone="gold">Register applicant</Button></Link>
        )}
      </PageTitle>
      <input className={`${inputClass} w-full sm:max-w-md`} placeholder="Search name, phone or applicant number" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="data-table-scroll rounded-2xl bg-surface shadow-sm">
        <table className="data-table text-left text-sm">
          <thead className="bg-canvas text-muted">
            <tr>
              <th className="table-cell-nowrap-sm">Reg. date</th>
              <th>
                <span className="sm:hidden">Person</span>
                <span className="hidden sm:inline">Full name</span>
              </th>
              <th>Reference</th>
              <th>Phone</th>
              <th>Type</th>
              <th>Community</th>
              <th className="table-col-disability">Disability</th>
              <th>Ghana Card</th>
              <th>
                <span className="sm:hidden">Endorsed</span>
                <span className="hidden sm:inline">Endorsed by</span>
              </th>
              <th className="table-cell-nowrap-sm text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-canvas">
                <td className="whitespace-nowrap text-xs sm:text-sm">
                  {formatAppDateFromIso(r.created_at) || "—"}
                </td>
                <td>
                  <button type="button" className="text-left hover:text-teal" onClick={() => setViewId(r.id)}>
                    <span className="block font-semibold text-navy">{registrationListPrimaryName(r)}</span>
                    {r.registration_type === "caregiver" && r.full_name?.trim() ? (
                      <span className="mt-0.5 block text-xs font-normal text-muted">
                        Beneficiary: {r.full_name.trim()}
                      </span>
                    ) : null}
                  </button>
                </td>
                <td>
                  <ReferenceNumber>{r.applicant_ref}</ReferenceNumber>
                </td>
                <td>{registrationListPrimaryPhone(r)}</td>
                <td className="text-xs font-semibold uppercase text-teal">
                  {r.registration_type === "caregiver" ? "Caregiver" : "PWD"}
                </td>
                <td>{registrationListPrimaryCommunity(r)}</td>
                <td className="table-col-disability">{registrationListDisabilityLabel(r)}</td>
                <td className="font-mono text-xs">{registrationListPrimaryGhanaCard(r)}</td>
                <td>{endorsedByLabel(r)}</td>
                <td className="table-cell-nowrap-sm text-right">
                  <button type="button" className="text-xs font-semibold text-teal hover:underline" onClick={() => setViewId(r.id)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewId && (
        <ApplicantViewModal
          applicantId={viewId}
          onClose={closeModal}
          onChanged={refreshList}
        />
      )}
    </div>
  );
}
