# PWD Support Register

Municipal register for DACF disability support: staff register applicants, process yearly applications, and report from **one shared database**.

## Demo logins (two accounts)

Use these for trials and client demos. Tap an account on the login screen to fill the form.

| Who | Email | Password |
|-----|--------|----------|
| **Social Welfare** (register applicants) | `welfare@demo.gh` | `Demo1234` |
| **System admin** (users & settings) | `admin@demo.gh` | `Demo1234` |

Change passwords before real production use.

## Run on your computer (development)

Node.js 22+.

```bash
npm install
npm run install:all
npm run dev
```

- App: http://localhost:5173  
- API health: http://localhost:4000/api/health  

Data file: `backend/data/pwd.sqlite`

## Deploy for the client

| Goal | Doc |
|------|-----|
| **Render** (recommended cloud + custom domain) | `docs/PAAS-HOSTING.md` |
| Office server / VPS + your domain | `docs/PRODUCTION-HOSTING.md` |
| LAN, offline registration, backups | `docs/HOSTING.md` |
| Zip install on a Windows PC you manage | `install/MANAGED-DEPLOYMENT.md` |

Logo: replace `frontend/public/system-logo.jpg`, then `npm run package:install` for a branded zip.

## Logo & package

```powershell
npm run package:install
```

Output under `release/` — runtime bundle for on-site install (you keep the full source repo).
