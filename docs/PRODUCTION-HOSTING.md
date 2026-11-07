# Production hosting with your own domain

One **VPS** (cloud server) runs the app. **Caddy** provides **HTTPS** on your domain. Every welfare officer uses the same URL and the same database.

---

## What you need

| Item | Example |
|------|---------|
| Domain or subdomain | `register.komendamunicipal.gov.gh` |
| VPS | 1 vCPU, 2 GB RAM, Ubuntu 24.04 (Hetzner, DigitalOcean, Lightsail, Azure, etc.) |
| DNS access | A record → VPS public IP |
| SSH | To install Docker on the VPS |

You keep the source repo; the VPS only runs the Docker stack.

---

## Step 1 — Buy or use a domain

1. Register the domain with your registrar (registrar.gh, Namecheap, Cloudflare, etc.), **or** add a **subdomain** on a domain the assembly already owns (`register.assembly.gov.gh`).
2. In DNS, create:

   | Type | Name | Value |
   |------|------|--------|
   | **A** | `register` (or `@`) | **VPS public IPv4** |

3. Wait 5–30 minutes. Check: `ping register.yourdomain.gov.gh` should show the VPS IP.

---

## Step 2 — Create the VPS

1. Create an Ubuntu 24.04 server (region close to Ghana if possible).
2. Open firewall: **TCP 80**, **TCP 443**, **TCP 22** (SSH).
3. Note the **public IP** — use it in the DNS A record.

SSH in:

```bash
ssh root@YOUR_VPS_IP
```

Install Docker:

```bash
curl -fsSL https://get.docker.com | sh
apt-get install -y docker-compose-plugin
```

---

## Step 3 — Deploy the app on the VPS

**On your Windows PC** (project folder), prepare secrets:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\prepare-domain.ps1
```

That creates `.env` with `PWD_DOMAIN` and a random `PWD_TOKEN_SECRET`.

Copy the project to the VPS (from your PC, one option):

```powershell
# Install rsync via WSL, or zip and scp
Compress-Archive -Path "C:\Users\Admin\Desktop\PWD System\*" -DestinationPath pwd-deploy.zip -Force
scp pwd-deploy.zip root@YOUR_VPS_IP:/root/
```

On the **VPS**:

```bash
cd /root
apt-get install -y unzip
unzip -o pwd-deploy.zip -d pwd-system
cd pwd-system
# Ensure .env is present (copy from PC if prepare-domain.ps1 only ran locally)
nano .env   # PWD_DOMAIN=register...  PWD_TOKEN_SECRET=...
docker compose up -d --build
docker compose ps
docker compose logs -f caddy
```

First successful HTTPS may take 1–2 minutes while Caddy requests a certificate.

---

## Step 4 — Send the client the link

**https://{PWD_DOMAIN}/**

Example: **https://register.komendamunicipal.gov.gh/**

Demo accounts (change passwords before go-live):

| Email | Password | Role |
|-------|----------|------|
| `register@accra.gh` | `Pwd@2026` | Social Welfare registration |
| `admin@ncpd.gov.gh` | `Pwd@2026` | System admin |

---

## Step 5 — Go-live checklist (you)

- [ ] DNS A record correct
- [ ] `PWD_TOKEN_SECRET` set to a long random value (not the example)
- [ ] Demo password `Pwd@2026` changed for all users
- [ ] `docker compose` shows both `pwd` and `caddy` running
- [ ] Backup: snapshot VPS or copy volumes `pwd-data` and `pwd-uploads` daily
- [ ] Stop the temporary **trycloudflare** tunnel on your PC so clients use only the real domain

### Backup on VPS

```bash
cd /root/pwd-system
docker compose exec pwd sh -c 'tar czf - data uploads' > pwd-backup-$(date +%Y%m%d).tar.gz
```

Download backups to your PC regularly.

### Updates

```bash
cd /root/pwd-system
# upload new code / git pull
docker compose up -d --build
```

Database and uploads stay in Docker volumes across rebuilds.

---

## Alternative: Windows server in the office

If the assembly insists on an on-prem Windows server with a domain:

1. Install **Docker Desktop** or run `npm run package:install` release without Docker.
2. Install **Caddy for Windows** with the same `deploy/Caddyfile` pattern and your domain pointing to the office **public** IP (router port-forward 443 → server).
3. Use a dynamic DNS service if the office IP changes.

For most clients, a small **cloud VPS + domain** is simpler and stays online when the office power fails.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Certificate errors | DNS must point to this VPS; ports 80/443 open |
| 502 Bad Gateway | `docker compose logs pwd` — API not started |
| Login works locally but not on domain | Set `TRUST_PROXY=1` (already in docker-compose) |
| Blank page | Rebuild: `docker compose up -d --build` |

---

## Related docs

- `docs/HOSTING.md` — LAN, offline registration, shared database
- `install/MANAGED-DEPLOYMENT.md` — you manage backups and upgrades
