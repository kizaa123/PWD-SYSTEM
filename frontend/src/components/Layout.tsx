import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { pingStaffPresence } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useLoading } from "../lib/loading";
import { GlobalLoadingBar, LoadingSpinner } from "./GlobalLoadingBar";
import { canRegisterApplicants, isOversightReader, workflowQueues } from "../lib/workflowAccess";
import { SidebarClock } from "./SidebarClock";
import { StaffProfileAvatar } from "./StaffProfileAvatar";
import { ConnectivityBar } from "./ConnectivityBar";
import { SystemBrandLogo } from "./SystemBrandLogo";

type Item = { to: string; label: string; icon: string; perm?: string | null };

const QUEUE_ICONS: Record<string, string> = {
  registration: "check",
  interview: "clipboard",
  selection: "stamp",
  disbursement: "truck",
};

const TAIL_NAV: Item[] = [
  { to: "/reports", label: "Reports", icon: "chart", perm: "reports.district" },
  { to: "/users", label: "Users and Roles", icon: "shield", perm: "users.manage" },
  { to: "/audit", label: "Audit Log", icon: "list", perm: "audit.read" },
];

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

export function Layout() {
  const { user, logout, has, isRole, person } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading: apiLoading } = useLoading();
  const showActivity = apiLoading;
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = useMemo(() => {
    const items: Item[] = [{ to: "/", label: "Dashboard", icon: "grid" }];
    if (canRegisterApplicants(has)) {
      items.push({ to: "/applicants", label: "Registration", icon: "users" });
    }
    if (isOversightReader(user, has, isRole)) {
      items.push({ to: "/applications", label: "Applications", icon: "doc" });
    }
    for (const q of workflowQueues(user, has, isRole)) {
      const label = q.status === "registration" ? "Application" : `${q.label} queue`;
      items.push({ to: q.to, label, icon: QUEUE_ICONS[q.status] || "doc" });
    }
    items.push(...TAIL_NAV);
    items.push({ to: "/settings", label: "Settings", icon: "gear" });
    return items.filter((item) => {
      if (!item.perm) return true;
      if (item.perm === "reports.district") return has("reports.district", "reports.region", "reports.national");
      return has(item.perm);
    });
  }, [user, has, isRole]);
  const name = (person?.full_name as string) || user?.email || "User";
  const roleCode = user?.roles?.[0] || "";
  const role = ROLE_LABELS[roleCode] || roleCode.replaceAll("_", " ");

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    pingStaffPresence().catch(() => {});
    const id = window.setInterval(() => pingStaffPresence().catch(() => {}), 45_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function signOut() {
    setMenuOpen(false);
    logout();
    navigate("/login");
  }

  function isCurrent(to: string) {
    const [path, query] = to.split("?");
    if (location.pathname !== path) return false;
    if (!query) {
      if (path === "/applications") return !location.search;
      return true;
    }
    const wanted = new URLSearchParams(query);
    const actual = new URLSearchParams(location.search);
    for (const [key, value] of wanted) {
      if (actual.get(key) !== value) return false;
    }
    return true;
  }

  return (
    <div className="app-shell min-h-screen bg-canvas text-navy">
      <div className="app-print-chrome">
        <GlobalLoadingBar />
        <ConnectivityBar />
      </div>
      <div className="flex min-h-screen">
        {menuOpen && (
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 bg-navy/50 md:hidden" onClick={() => setMenuOpen(false)} />
        )}

        <aside
          id="sidebar"
          className={`app-print-chrome fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col bg-navy text-white transition-transform duration-200 md:sticky md:top-0 md:z-30 md:h-screen md:translate-x-0 ${
            menuOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
          }`}
        >
          <div className="flex items-start justify-between border-b border-white/10 px-4 py-4">
            <SystemBrandLogo />
            <button type="button" className="rounded-lg p-1 text-white/80 md:hidden" aria-label="Close sidebar" onClick={() => setMenuOpen(false)}>
              <NavIcon name="close" />
            </button>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3 pb-4">
            {nav.map((item) => {
              const current = isCurrent(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={current ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] ${
                    current ? "bg-teal font-semibold text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <NavIcon name={item.icon} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 bg-navy/80 px-4 py-4">
            <SidebarClock />
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <StaffProfileAvatar
                key={String(person?.photo_path ?? "none")}
                name={name}
                photoPath={typeof person?.photo_path === "string" ? person.photo_path : null}
                className="h-12 w-12"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold leading-tight text-white">{name}</div>
                <div className="mt-0.5 truncate text-[11px] font-medium capitalize text-teal-200/90">{role}</div>
              </div>
            </div>
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-red-400/35 hover:bg-red-500/20 hover:text-red-50 active:scale-[0.99]"
              onClick={signOut}
            >
              <NavIcon name="logout" />
              Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="app-print-chrome sticky top-0 z-[45] flex items-center gap-3 border-b border-navy/10 bg-surface px-4 py-3 md:hidden">
            <button
              type="button"
              className="rounded-xl p-3 text-navy hover:bg-canvas active:bg-canvas/80"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <NavIcon name={menuOpen ? "close" : "menu"} large />
            </button>
            <div className="min-w-0 flex-1 text-sm font-semibold text-navy">PWD Support</div>
            {showActivity ? (
              <span className="shrink-0 text-teal" aria-live="polite" aria-label="Loading">
                <LoadingSpinner className="h-5 w-5" />
              </span>
            ) : null}
          </header>
          <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6">
            <div key={location.pathname} className="page-route-enter min-w-0">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function NavIcon({ name, large = false }: { name: string; large?: boolean }) {
  const dim = large ? 26 : 16;
  const common = { width: dim, height: dim, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true as const };
  const stroke = { stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "menu") return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" {...stroke} /></svg>;
  if (name === "close") return <svg {...common}><path d="M6 6l12 12M18 6 6 18" {...stroke} /></svg>;
  if (name === "mark") return <svg {...common}><circle cx="12" cy="8" r="3" {...stroke} /><path d="M6 19c1-3 3-4.5 6-4.5s5 1.5 6 4.5" {...stroke} /></svg>;
  if (name === "grid") return <svg {...common}><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" {...stroke} /></svg>;
  if (name === "users") return <svg {...common}><circle cx="9" cy="8" r="3" {...stroke} /><path d="M3.5 19c.8-3 2.8-4.5 5.5-4.5S13.7 16 14.5 19" {...stroke} /><circle cx="17" cy="9" r="2.2" {...stroke} /></svg>;
  if (name === "doc") return <svg {...common}><path d="M7 3.5h7l4 4V20H7z" {...stroke} /><path d="M14 3.5V8h4" {...stroke} /></svg>;
  if (name === "layers") return <svg {...common}><path d="m12 3 9 5-9 5L3 8zM3 13l9 5 9-5M3 17l9 5 9-5" {...stroke} /></svg>;
  if (name === "check") return <svg {...common}><circle cx="12" cy="12" r="8" {...stroke} /><path d="m8.5 12 2.4 2.4 4.6-5" {...stroke} /></svg>;
  if (name === "clipboard") return <svg {...common}><path d="M8 5h8v3H8zM7 6.5H6a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-1" {...stroke} /></svg>;
  if (name === "stamp") return <svg {...common}><path d="M8 13V8a4 4 0 0 1 8 0v5M6 16h12M7 20h10" {...stroke} /></svg>;
  if (name === "truck") return <svg {...common}><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" {...stroke} /><circle cx="7" cy="17.5" r="1.5" {...stroke} /><circle cx="17" cy="17.5" r="1.5" {...stroke} /></svg>;
  if (name === "chart") return <svg {...common}><path d="M5 19V10M12 19V5M19 19v-7" {...stroke} /></svg>;
  if (name === "shield") return <svg {...common}><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" {...stroke} /></svg>;
  if (name === "list") return <svg {...common}><path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" {...stroke} /></svg>;
  if (name === "gear") return <svg {...common}><circle cx="12" cy="12" r="3" {...stroke} /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" {...stroke} /></svg>;
  if (name === "logout") return <svg {...common}><path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2M14 12H4M7 9l-3 3 3 3" {...stroke} /></svg>;
  return <svg {...common}><path d="M12 5v14M5 12h14" {...stroke} /></svg>;
}
