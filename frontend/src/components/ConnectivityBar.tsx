import { useEffect, useState } from "react";
import { apiReachable, browserOnline } from "../lib/connection";
import { flushPendingRegistrations, getSyncSummary, onRegistrationSyncChange } from "../lib/registrationSync";

export function ConnectivityBar() {
  const [online, setOnline] = useState(browserOnline());
  const [serverOk, setServerOk] = useState(true);
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState(0);
  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    const on = browserOnline();
    setOnline(on);
    const ok = on ? await apiReachable() : false;
    setServerOk(ok);
    const summary = await getSyncSummary();
    setPending(summary.pending);
    setErrors(summary.errors);
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
    window.addEventListener("offline", onOnline);
    const unsub = onRegistrationSyncChange(() => void refresh());
    const id = window.setInterval(() => void refresh(), 90_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
      unsub();
      window.clearInterval(id);
    };
  }, []);

  const showOffline = !online || !serverOk;
  const showQueue = pending > 0 || errors > 0;

  if (!showOffline && !showQueue) return null;

  return (
    <div
      className={`border-b px-4 py-2 text-sm ${
        showOffline ? "border-amber-200 bg-amber-50 text-amber-950" : "border-teal-200 bg-teal-50 text-teal-950"
      }`}
      role="status"
    >
      {showOffline ? (
        <p>
          <strong>Offline or server unreachable.</strong> You can still complete <em>New Applicant Registration</em>; records
          stay on this device and upload automatically when the connection returns.
        </p>
      ) : null}
      {showQueue ? (
        <p className={showOffline ? "mt-1" : ""}>
          {syncing ? "Uploading queued registrations…" : null}
          {!syncing && pending > 0 ? `${pending} registration(s) waiting to upload. ` : null}
          {!syncing && errors > 0 ? `${errors} need attention (open Applicants after sync).` : null}
        </p>
      ) : null}
    </div>
  );
}
