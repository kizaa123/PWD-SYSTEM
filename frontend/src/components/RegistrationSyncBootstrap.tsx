import { useEffect } from "react";
import { flushPendingRegistrations } from "../lib/registrationSync";

/** Starts background sync when the app loads and when connectivity returns. */
export function RegistrationSyncBootstrap() {
  useEffect(() => {
    void flushPendingRegistrations();
    const run = () => void flushPendingRegistrations();
    window.addEventListener("online", run);
    const id = window.setInterval(run, 120_000);
    return () => {
      window.removeEventListener("online", run);
      window.clearInterval(id);
    };
  }, []);
  return null;
}
