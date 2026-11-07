import { useLoading } from "../lib/loading";

export function GlobalLoadingBar() {
  const { isLoading } = useLoading();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-transparent"
      aria-hidden={!isLoading}
    >
      <div
        className={`global-loading-bar h-full bg-gradient-to-r from-teal via-teal/90 to-teal ${isLoading ? "is-active" : ""}`}
      />
    </div>
  );
}

export function LoadingSpinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  );
}

export function AppBootScreen({ label = "Loading register…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-navy">
      <LoadingSpinner className="h-10 w-10 text-teal" />
      <p className="text-sm font-medium text-muted">{label}</p>
    </div>
  );
}
