import { FormEvent, useEffect, useRef, useState } from "react";
import { updateMyProfile, uploadMyStaffProfilePhoto } from "../lib/api";
import { useAuth } from "../lib/auth";
import { PageTitle } from "../components/PageTitle";
import { Button, Field, inputClass } from "../components/StatusBadge";
import { StaffProfileAvatar } from "../components/StaffProfileAvatar";
import { LoadingSpinner } from "../components/GlobalLoadingBar";

const ROLE_LABELS: Record<string, string> = {
  fund_committee: "Final approver",
  registration_officer: "Social Welfare Officer",
  verification_officer: "Interview Officer",
  assessment_officer: "Interview Officer",
  district_officer: "District Officer",
  finance_officer: "Finance Officer",
  regional_officer: "Regional Officer",
  national_admin: "National Administrator",
  system_admin: "System Administrator",
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-navy">{children}</dd>
    </div>
  );
}

export function SettingsPage() {
  const { user, person, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(() => (typeof person?.full_name === "string" ? person.full_name : ""));
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof person?.full_name === "string") setFullName(person.full_name);
  }, [person?.full_name]);

  const roleCode = user?.roles?.[0] || "";
  const roleLabel = ROLE_LABELS[roleCode] || roleCode.replaceAll("_", " ");
  const photoPath = typeof person?.photo_path === "string" ? person.photo_path : null;
  const savedName = (typeof person?.full_name === "string" ? person.full_name : "") || user?.email || "Staff";
  const displayName = savedName;

  function startEdit() {
    setFullName(typeof person?.full_name === "string" ? person.full_name : "");
    setError("");
    setMessage("");
    setEditing(true);
  }

  function cancelEdit() {
    setFullName(typeof person?.full_name === "string" ? person.full_name : "");
    setError("");
    setEditing(false);
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await updateMyProfile(fullName.trim());
      await refresh();
      setMessage("Your profile was updated.");
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onPhotoPick(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    try {
      await uploadMyStaffProfilePhoto(file);
      await refresh();
      setMessage("Profile photo updated.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle title="Settings" subtitle="Your staff profile. Username and password are managed by an administrator." />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-teal/30 bg-teal/10 px-4 py-2 text-sm text-navy">{message}</div>}

      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-surface p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-navy">My information</h2>

        {!editing ? (
          <div className="mt-4">
            <div className="mb-6 flex justify-center">
              <StaffProfileAvatar key={String(photoPath ?? "none")} name={displayName} photoPath={photoPath} className="h-40 w-40 text-3xl" />
            </div>
            <dl>
              <InfoRow label="Display name">{savedName}</InfoRow>
              <InfoRow label="Username">{user?.email || "—"}</InfoRow>
              <InfoRow label="Role">{roleLabel}</InfoRow>
              <InfoRow label="Password">
                <span className="text-muted">••••••••••</span>
                <p className="mt-1 text-xs font-normal text-muted">Contact your system administrator to reset your password.</p>
              </InfoRow>
            </dl>
            <div className="mt-6 pt-2">
              <Button type="button" className="w-full" onClick={startEdit}>
                Edit
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={saveProfile} className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3">
              <StaffProfileAvatar key={String(photoPath ?? "none")} name={fullName.trim() || displayName} photoPath={photoPath} className="h-40 w-40 text-3xl" />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPhotoPick(e.target.files?.[0])}
              />
              <Button type="button" tone="ghost" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
                {photoBusy ? (
                  <span className="inline-flex items-center gap-2">
                    <LoadingSpinner className="h-4 w-4" />
                    Uploading…
                  </span>
                ) : (
                  "Change photo"
                )}
              </Button>
            </div>

            <Field label="Display name">
              <input
                className={inputClass}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                autoComplete="name"
              />
            </Field>
            <Field label="Username (sign-in email)">
              <input className={`${inputClass} cursor-not-allowed bg-canvas text-muted`} value={user?.email || ""} readOnly aria-readonly />
            </Field>
            <Field label="Role">
              <input className={`${inputClass} cursor-not-allowed bg-canvas capitalize text-muted`} value={roleLabel} readOnly aria-readonly />
            </Field>
            <Field label="Password">
              <input className={`${inputClass} cursor-not-allowed bg-canvas text-muted`} value="••••••••••" readOnly aria-readonly />
              <p className="mt-1 text-xs text-muted">Password cannot be changed here.</p>
            </Field>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" tone="ghost" disabled={saving} onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
