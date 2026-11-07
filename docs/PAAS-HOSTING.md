# Hosting on Render, Vercel, and Supabase

This app is a **single Node server** (Express + SQLite file + local uploads + React build). Not every PaaS fits that shape.

## Quick recommendation

| Platform | Fit for this project | Use for |
|----------|----------------------|---------|
| **Render** | **Yes — recommended** | Full app + custom domain + HTTPS in one place |
| **Vercel** | Partial | Static UI only; API must live elsewhere (e.g. Render) |
| **Supabase** | Not yet | Would replace SQLite + file storage (Postgres + Storage) — a migration project |

**For your client link today:** deploy everything on **Render** with `render.yaml` in this repo.

---

## Render (recommended)

### What you get

- URL like `https://pwd-support.onrender.com`
- **Custom domain** + free TLS in the Render dashboard
- **One shared database** (SQLite on a persistent disk)
- No tunnel and no PC left on overnight

### Steps

1. **Push the project to GitHub** (Render deploys from git). If you only have a local folder, create a private repo and push.
2. Go to [render.com](https://render.com) → **New** → **Blueprint**.
3. Connect the repo; Render reads **`render.yaml`** at the root.
4. Approve create — it builds the **Dockerfile** and attaches a **1 GB disk** at `/var/data`.
5. Wait for deploy; open the `.onrender.com` URL → `/api/health` should return `ok`.
6. **Custom domain:** Service → **Settings** → **Custom Domains** → add `register.yourassembly.gov.gh` → set the DNS record Render shows (usually CNAME or A).
7. In **Environment**, confirm `PWD_TOKEN_SECRET` was generated; add no extra vars unless you change disk paths.

### Costs (typical)

- **Starter** web service (always on, no spin-down): small monthly fee (check current Render pricing).
- **Persistent disk**: required so SQLite and uploads survive restarts — billed per GB-month.

Free Render tiers that **sleep** and **lack disk** are **not** suitable for production register data.

### Demo login (after first deploy)

| Who | Email | Password |
|-----|--------|----------|
| Social Welfare | `welfare@demo.gh` | `Demo1234` |
| System admin | `admin@demo.gh` | `Demo1234` |

Change passwords before go-live.

### Backups on Render

Periodically download the disk via a one-off job or SSH/shell if enabled, or export `pwd.sqlite` from a backup script you run through Render shell. At minimum: weekly copy of the database file from `/var/data/pwd.sqlite`.

---

## Vercel

Vercel is built for **static sites and serverless functions**, not a long-running Express app with a SQLite file on disk.

| Approach | Verdict |
|----------|---------|
| Whole app on Vercel | **No** — no persistent SQLite/uploads |
| Frontend on Vercel, API on Render | **Possible** but awkward (two URLs, proxy rewrites, CORS, offline sync harder) |

If you still split:

1. Deploy the **backend** to Render (above).
2. Build the frontend with a public API base — would need a small code change (`VITE_API_BASE`) — **not enabled by default**; same-origin `/api` is assumed.

**Recommendation:** skip Vercel unless the assembly already pays for it; use Render alone.

---

## Supabase

Supabase provides **Postgres**, **Auth**, and **Storage**. This codebase uses:

- **SQLite** (`pwd.sqlite`)
- **Local JWT auth** in the API
- **Multer → disk** for photos

Moving to Supabase means:

- Schema migration to Postgres (or dual-write period)
- Replace or bridge auth
- Store uploads in Supabase Storage with signed URLs

That is a **planned upgrade**, not a button-click deploy. When the register outgrows SQLite or needs multi-region replicas, Supabase (or managed Postgres on Render) is the right direction — contact your implementer for that phase.

---

## Render vs your own VPS

| | Render | VPS + `docker-compose` |
|--|--------|-------------------------|
| Setup | Blueprint + git push | SSH, Docker, DNS |
| TLS / domain | Render UI | Caddy + `docs/PRODUCTION-HOSTING.md` |
| Data | Paid persistent disk | VPS volumes |
| Best for | Fast client trial & managed ops | Maximum control, national scale later |

---

## Checklist for client handover

- [ ] App on Render (or VPS), not trycloudflare
- [ ] Custom domain configured
- [ ] `Demo1234` changed on both demo accounts (or replace with real staff users)
- [ ] `PWD_TOKEN_SECRET` set (auto on Render)
- [ ] Welfare staff bookmark **one HTTPS URL**
- [ ] You retain GitHub repo + backup of `/var/data`

Related: `docs/HOSTING.md` (LAN/offline), `docs/PRODUCTION-HOSTING.md` (VPS + Caddy).
