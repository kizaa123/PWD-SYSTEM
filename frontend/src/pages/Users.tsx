import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatAppDateTimeFromIso } from "../lib/dateFormat";
import { Button, Field, inputClass } from "../components/StatusBadge";
import { PageTitle } from "../components/PageTitle";

type Payload = {
  users: {
    id: string;
    email: string;
    status: string;
    full_name: string;
    roles: string[];
    last_login_at: string | null;
  }[];
  roles: { code: string; name: string }[];
};

export function UsersPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "Demo1234", fullName: "", roleCode: "registration_officer", scopeLevel: "district" });

  function load() {
    api<Payload>("/api/users").then(setData).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify(form) });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle(id: string, status: string) {
    await api(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify({ status: status === "active" ? "suspended" : "active" }) });
    load();
  }

  if (!data) return <div>{error || "Loading users…"}</div>;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Users and Roles"
        subtitle="Activate, suspend and assign roles. Staff manage their own profile photos under Settings."
      />
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <form onSubmit={create} className="grid gap-3 rounded-2xl bg-surface p-5 shadow-sm md:grid-cols-5">
        <Field label="Name"><input className={inputClass} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
        <Field label="Email"><input className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Role">
          <select className={inputClass} value={form.roleCode} onChange={(e) => setForm({ ...form, roleCode: e.target.value })}>
            {data.roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </Field>
        <Field label="Password"><input className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        <div className="flex items-end"><Button>Create user</Button></div>
      </form>
      <div className="data-table-scroll rounded-2xl bg-surface shadow-sm">
        <table className="data-table text-left text-sm">
          <thead className="bg-canvas text-muted">
            <tr>
              <th>User</th>
              <th>Roles</th>
              <th className="table-cell-nowrap-sm">Status</th>
              <th className="table-cell-tight">Last login</th>
              <th className="table-cell-nowrap-sm"></th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} className="border-t border-canvas">
                <td>
                  <div className="font-semibold">{u.full_name}</div>
                  <div className="text-xs text-muted">{u.email}</div>
                </td>
                <td>{u.roles.join(", ")}</td>
                <td>{u.status}</td>
                <td>{formatAppDateTimeFromIso(u.last_login_at) || "—"}</td>
                <td>
                  <Button tone="ghost" onClick={() => toggle(u.id, u.status)}>{u.status === "active" ? "Suspend" : "Activate"}</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
