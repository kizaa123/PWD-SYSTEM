# Managed deployment (you operate, you keep the files)

Use this model when **you** host or install the system, apply updates, and retain the **full source repo** and release builds. The organisation uses the app in the browser; they do not need the development project.

## What you keep (never hand off unless contracted)

| Asset | Location |
|--------|----------|
| Full source code | This repo (`PWD System`) |
| Versioned release zips | `release/PWD-Support-Register-v*-*.zip` |
| Build script | `install/Package-Release.ps1`, `npm run package:install` |
| Brand master logo | `frontend/public/system-logo.jpg` |
| Your runbooks & credentials | Password manager, `.env` if added later |

Treat each zip as a **deploy artefact**, not a source-code transfer.

## What lives at the organisation (their data + runtime)

On the PC or server you install for them:

- `backend/data/pwd.sqlite` — register database (**back this up**; it is theirs operationally)
- `backend/uploads/` — passport photos, receipts, etc.
- `web/` — built UI (replace on each upgrade you deploy)
- `backend/` — API runtime (you update when you ship fixes)

They can use the machine daily; you retain the right to remote in, patch, and restore from backups.

## Recommended workflow

1. **Develop** in the repo (`npm run dev`).
2. **Package** when ready: `npm run package:install` (logo baked into `web/` and `branding/`).
3. **Deploy** — copy the zip to their server, unzip (e.g. `C:\PWD-Support-Register`), run `Install.ps1` once, then `Start-PWD-Support.bat` (or install as a Windows Service later).
4. **Upgrade** — build a new zip; stop the app; copy new `web/` and `backend/src` (or whole backend except `data/` and `uploads/`); `npm install` in backend if dependencies changed; restart.
5. **Backup** (your job on a schedule):
   - `backend/data/pwd.sqlite`
   - `backend/uploads/`
   - Store copies off-site (your cloud / encrypted drive).

## Access model

- **Staff** — accounts you or their admin create; they only see https://their-server:4000 (or your reverse proxy URL).
- **You** — RDP/AnyDesk to the server, or SSH if Linux later; plus your copy of releases and source for fixes.

## What to tell the client

- The **register data** belongs to the organisation; you help protect it with backups.
- **Software updates** come from you, not from them editing files.
- Logo changes: you replace `frontend/public/system-logo.jpg`, repackage, redeploy `web/` + `branding/`.

Client-facing steps are in `install/client/INSTALL.txt` (simplified; mentions their implementer).

## Optional next steps (still managed by you)

- Put **IIS/nginx + HTTPS** in front of port 4000.
- Run API as a **Windows Service** so it survives reboot without the `.bat`.
- Move SQLite → **PostgreSQL** when multi-site or heavy reporting needs it.
