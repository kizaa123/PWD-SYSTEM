import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { isStaffPortalUser } from "../lib/portalAccess";
import { SystemLogoImage } from "../components/SystemBrandLogo";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../lib/demoAccounts";

const FEATURES = [
  {
    title: "Staff registration",
    detail: "Register applicants at the assembly",
    icon: "users",
  },
  {
    title: "Process applications",
    detail: "Verification, assessment and committee approval",
    icon: "doc",
  },
  {
    title: "Track Progress",
    detail: "From submission to fulfilment",
    icon: "shield",
  },
  {
    title: "Transparent & Accountable",
    detail: "Data-driven decisions and reporting",
    icon: "chart",
  },
];

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-11 pr-11 text-sm text-[#0f2438] shadow-sm transition placeholder:text-slate-400 focus:border-[#00827f] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00827f]/25";

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (user && isStaffPortalUser(user.roles)) navigate("/");
  }, [user, navigate]);

  useEffect(() => {
    const state = location.state as { staffOnly?: boolean } | null;
    if (state?.staffOnly) {
      setError("This system is for authorised assembly staff only.");
    }
  }, [location.state]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#12345a] lg:grid lg:grid-cols-2">
      {/* Left Pane */}
      <aside className="relative hidden min-h-screen overflow-hidden text-white lg:flex lg:flex-col lg:justify-between p-10 xl:p-14">
        {/* Background photo of smiling young man in wheelchair */}
        <img
          src="/login-hero.jpg"
          alt="PWD Support Register"
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />

        {/* Gradient overlays — lighter so the photo shows through */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0c2a47]/58 via-[#0e3153]/38 to-[#081e33]/72" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c2a47]/62 via-[#0c2a47]/15 to-transparent" />

        {/* Curved decorative wave in bottom corner */}
        <svg
          className="pointer-events-none absolute -bottom-1 -right-1 h-64 w-[85%]"
          viewBox="0 0 640 240"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 160c110 50 200 80 330 65s200-75 310-125v140H0V160z"
            fill="#007471"
            opacity="0.8"
          />
          <path
            d="M30 185c120 40 220 50 330 35s180-55 280-90v110H30V185z"
            fill="#062138"
            opacity="0.7"
          />
        </svg>

        {/* Top Header & Branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <LoginSystemLogo />
            <div className="min-w-0">
              <h2 className="font-['Outfit',sans-serif] text-[clamp(1.05rem,2.2vw,1.45rem)] font-bold leading-snug tracking-tight text-white">
                PWD Support Management System
              </h2>
              <p className="mt-2 max-w-md text-[14px] font-normal leading-relaxed text-white/88">
                Helping persons with disability and their caregivers access education, health, livelihood, and caregiver support with dignity, fairness, and a clear path from registration to approved help.
              </p>
            </div>
          </div>
        </div>

        {/* Middle Spacer */}
        <div className="relative z-10 flex-1 my-auto" />

        {/* Features List */}
        <div className="relative z-10 max-w-md">
          <ul className="space-y-4 mb-8">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-center gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00827f] shadow-sm">
                  <FeatureIcon name={f.icon} />
                </span>
                <div>
                  <div className="text-[15px] font-semibold text-white leading-tight">{f.title}</div>
                  <div className="text-[13px] text-white/75 leading-tight mt-0.5">{f.detail}</div>
                </div>
              </li>
            ))}
          </ul>

          {/* Government of Ghana badge */}
          <div className="flex items-center gap-3 pt-2">
            <GhanaFlagRect />
            <span className="text-[13px] font-medium text-white/92">Government of Ghana</span>
          </div>
        </div>
      </aside>

      {/* Right Form Pane */}
      <section className="relative flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-white">
        <div className="flex items-center px-6 pt-6 sm:px-10 lg:hidden">
          <div className="flex items-center gap-2.5">
            <LoginSystemLogo compact />
            <span className="text-sm font-bold leading-tight text-[#12345a]">PWD Support Management System</span>
          </div>
        </div>

        {/* Login Card Area */}
        <div className="mx-auto flex w-full max-w-[460px] flex-1 flex-col justify-center px-6 py-8 sm:px-8">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
          <div className="mb-6 text-center">
            <img
              src="/Coat_of_arms_of_Ghana.svg.webp"
              alt="Republic of Ghana"
              className="mx-auto h-[4.5rem] w-auto object-contain"
            />
            <div className="mt-2.5 text-[10px] font-bold tracking-[0.22em] text-[#0c2a47]">
              REPUBLIC OF GHANA
            </div>
          </div>

          <h1 className="font-['Outfit',sans-serif] text-[1.75rem] font-bold tracking-tight text-[#0c2a47]">Welcome back</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Sign in with your authorised staff account.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-5">
            {error && (
              <div
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-xl bg-blue-50 px-3.5 py-2.5 text-sm text-blue-700">
                {notice}
              </div>
            )}

            {/* Email or Username */}
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email or username</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[#94a3b8]">
                  <UserOutlineIcon />
                </span>
                <input
                  className={fieldClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email or username"
                  autoComplete="username"
                  required
                />
              </div>
            </label>

            {/* Password */}
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[#94a3b8]">
                  <LockOutlineIcon />
                </span>
                <input
                  className={fieldClass}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 flex items-center rounded-lg px-2 text-[#94a3b8] hover:text-[#0f2438]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-between pt-0.5 text-sm">
              <label className="inline-flex cursor-pointer items-center gap-2 text-[#0f2438]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-[#cbd5e1] text-[#00827f] accent-[#00827f]"
                />
                <span className="text-[13px] text-[#334155]">Remember me</span>
              </label>
              <button
                type="button"
                className="text-[13px] font-semibold text-[#00827f] hover:underline"
                onClick={() => setNotice("Password reset is managed by the MMDA District IT Desk.")}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00827f] py-3.5 text-sm font-semibold text-white shadow-md shadow-[#00827f]/25 transition hover:bg-[#00706d] active:scale-[0.99] disabled:opacity-60"
            >
              <span>{busy ? "Signing in…" : "Sign In"}</span>
              {!busy && <ArrowRightIcon />}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200/80 pt-5">
            <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Try the demo</p>
            <ul className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((account) => (
                <li key={account.email}>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 text-left text-[12px] transition hover:border-[#00827f]/40 hover:bg-white"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setError("");
                    }}
                  >
                    <span className="font-semibold text-[#0f2438]">{account.label}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-slate-600">{account.email}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-center text-[11px] text-slate-500">
              Password for both: <span className="font-mono font-medium text-slate-700">{DEMO_PASSWORD}</span>
            </p>
          </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function LoginSystemLogo({ compact = false }: { compact?: boolean }) {
  const size = compact ? "h-12 w-12" : "h-[6.75rem] w-[6.75rem]";
  return (
    <div
      className={`${size} shrink-0 overflow-hidden rounded-[50%] border-2 border-white/25 bg-white shadow-lg ring-2 ring-[#00827f]/40`}
    >
      <SystemLogoImage className="h-full w-full scale-110 object-cover" alt="PWD Support logo" />
    </div>
  );
}

function GhanaFlagRect() {
  return (
    <img
      src="/ghana-flag.webp"
      alt=""
      className="h-[1.35rem] w-[2.1rem] shrink-0 object-cover shadow-sm ring-1 ring-white/35"
      aria-hidden
    />
  );
}

function FeatureIcon({ name }: { name: string }) {
  const props = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true as const };
  if (name === "users") {
    return (
      <svg {...props}>
        <circle cx="9" cy="8" r="3" stroke="white" strokeWidth="1.8" />
        <path d="M3.8 19c.7-3 2.6-4.4 5.2-4.4s4.5 1.4 5.2 4.4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="17" cy="9" r="2.2" stroke="white" strokeWidth="1.8" />
        <path d="M16.2 14.6c1.8.4 3 1.5 3.6 3.6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "doc") {
    return (
      <svg {...props}>
        <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" stroke="white" strokeWidth="1.8" />
        <path d="M14 3.5V8h4M9 13h6M9 16.5h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg {...props}>
        <path d="M12 3.5 19 6v5.2c0 4.6-2.9 7.8-7 9.3-4.1-1.5-7-4.7-7-9.3V6l7-2.5z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m9 12 2 2 4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M5 19V10M12 19V5M19 19v-7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UserOutlineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19c1-3.2 3.1-4.8 6.5-4.8s5.5 1.6 6.5 4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function LockOutlineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 12S6.2 6 12 6s9.5 6 9.5 6-3.7 6-9.5 6S2.5 12 2.5 12z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 4l18 16M9.5 6.4A10 10 0 0 1 12 6c5.8 0 9.5 6 9.5 6a17 17 0 0 1-3.4 4M6.6 7.8A16 16 0 0 0 2.5 12S6.2 18 12 18c1.2 0 2.3-.2 3.3-.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IdBadgeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 16c.8-1.8 2-2.5 3.5-2.5s2.7.7 3.5 2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M15 9h3M15 13h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

