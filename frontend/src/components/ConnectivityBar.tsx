import { useEffect, useState } from "react";
import { apiReachable } from "../lib/connection";
import { flushPendingRegistrations, getSyncSummary, onRegistrationSyncChange } from "../lib/registrationSync";

export function ConnectivityBar() {
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState(0);
  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    const summary = await getSyncSummary();
    setPending(summary.pending);
    setErrors(summary.errors);
    const ok = await apiReachable();
    if (ok && (summary.pending > 0 || summary.errors > 0)) {
      setSyncing(true);
      await flushPendingRegistrations();
      const after = await getSyncSummary();
      setPending(after.pending);
      setErrors(after.errors);
      setSyncing(false);
    }
  }

  useEffect(() => {
    refresh();
    const onOnline = () => void refresh();
    window.addEventListener("online", onOnline);
    const unsub = onRegistrationSyncChange(() => void refresh());
    const id = window.setInterval(() => void refresh(), 90_000);
    return () => {
      window.removeEventListener("online", onOnline);
      unsub();
      window.clearInterval(id);
    };
  }, []);

  if (pending === 0 && errors === 0) return null;

  return (
    <div className="border-b border-teal-200 bg-teal-50 px-4 py-2 text-sm text-teal-950" role="status">
      <p>
        {syncing ? "Uploading queued items…" : null}
        {!syncing && pending > 0 ? `${pending} item(s) waiting to sync. ` : null}
        {!syncing && errors > 0 ? `${errors} item(s) need attention after sync.` : null}
      </p>
    </div>
  );
}
