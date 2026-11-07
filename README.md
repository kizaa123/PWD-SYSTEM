# PWD Care Register

National Council on Persons with Disability (NCPD) case register for District Assemblies Common Fund (DACF) support. Built from the official 2024 application and caregiver assessment forms, Nicholas’s support-type rules, and the recommended modular-monolith architecture.

## Verdict on the architecture (including regions)

The architecture is **solid enough to run nationwide and to serve regional officers**, with a few gaps that this implementation already closes.

**What already worked for regional scale**

- Ghana’s DACF process is district-owned. Keeping final approval with District Officers, and giving Regional Officers monitoring plus escalation, matches the official forms (endorsement is by the NCPD District Officer).
- A modular monolith (React + Node + relational database) is the right first version. Sixteen regions and ~260 MMDs do not justify microservices.
- Splitting `persons` from `users` is correct: staff can register applicants who have no login.
- Workflow statuses, audit events, and geographic permission checks are the right control points for regional isolation.

**Gaps that would have broken regional operations if left as specified**

1. `DISTRICT 1 ── * USERS` is too weak. A Regional Officer covers every district in a region. This system uses `user_scopes` (`district` | `region` | `national`).
2. Applications must store **both** `district_id` and `region_id` so regional dashboards do not join through applicants on every query.
3. Official NCPD forms collect more than Nicholas’s four headings: Schedule B disability types, residence, OPD membership, previous fund, apprenticeship, assistive devices, caregiving hours. Those fields are in the schema so districts are not forced into free-text later.
4. Assistive Device is a separate official form category. It is seeded as a fifth configurable category so policy can enable or hide it without a rewrite.
5. Ghana Card / NHIS are stored as **declared** identifiers until an approved NIA/NHIA integration exists. The UI never claims they are verified.

**Still awaiting client policy (not software blockers)**

- Whether one applicant may hold open applications in several categories at once.
- Exact repeat-support intervals and funding caps.
- Whether a Regional Officer may override a district decision, or only monitor and escalate.
- Hosting, backup RPO/RTO, and Data Protection Act 843 sign-off.

## Support types implemented

| Category | Extra required fields |
|---|---|
| Educational Support | School name, school account details, level, enrolment, fees/bursary/technical aid |
| Health Support | NHIS number, medical receipt/invoice upload, purpose, provider |
| Income Generating | Start-up capital **or** start-up tool, business activity |
| Caregivers Support | Caregiver Ghana Card, PWD NHIS, relationship, hours/years, purpose |
| Assistive Device (official form, configurable) | Device type, existing support |

General requirements on every applicant: passport picture, Ghana Card, NHIS if not linked.

## How to run

Requires Node.js 22+.

```bash
cd "C:\Users\Admin\Desktop\PWD System"
npm install
npm run install:all
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/health

Demo password for all seeded staff and applicant accounts: **`Pwd@2026`**

| Role | Email |
|---|---|
| Applicant (Accra) | applicant@demo.gh |
| Registration Officer | register@accra.gh |
| Verification Officer | verify@accra.gh |
| Assessment Officer | assess@accra.gh |
| District Officer — Accra Metro | district@accra.gh |
| Finance / Fulfilment | finance@accra.gh |
| Regional Officer — Greater Accra | regional@greateraccra.gh |
| District Officer — Kumasi | district@kumasi.gh |
| Regional Officer — Ashanti | regional@ashanti.gh |
| National Administrator | national@ncpd.gov.gh |
| Auditor | auditor@ncpd.gov.gh |

Sign in as Accra District Officer to approve the seeded education case. Sign in as Greater Accra Regional Officer to see Accra cases but not Kumasi. Sign in as Ashanti Regional Officer to confirm the reverse. That is the regional isolation test.

Local data is SQLite (`backend/data/pwd.sqlite`) so the pilot can start without Docker. Production should move the same schema to PostgreSQL, private object storage, HTTPS, and MFA for approval/finance/admin roles.

## Installation package (branded, you manage)

Put your organisation logo in `frontend/public/system-logo.jpg` (login, sidebar, browser tab). From the repo root:

```powershell
npm run package:install
```

Output: `release/PWD-Support-Register-v*-*.zip` — a **runtime bundle** to install on the organisation’s PC or server. **Keep the full repo and past zips on your side**; deploy and upgrade from those builds. See **`install/MANAGED-DEPLOYMENT.md`** for backup paths, upgrade steps, and what stays with you vs what lives on site.

On site: unzip, run `Install.ps1` once, start with `Start-PWD-Support.bat`, browse to http://localhost:4000/. Client-facing text is in `install/client/INSTALL.txt` (written for implementer-managed support).

## Hosting, shared database, and offline registration

Welfare staff share **one central database** on your server. Registration can queue on a PC when offline and **sync automatically** when the server is reachable. Full steps: **`docs/HOSTING.md`**.

## Production hosting (your own domain + HTTPS)

- **Render / Vercel / Supabase:** **`docs/PAAS-HOSTING.md`** — use **Render** + root **`render.yaml`** for the full app and custom domain.
- **Your own VPS:** **`docs/PRODUCTION-HOSTING.md`** — `docker compose` + Caddy.
