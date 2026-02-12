# ResourceManager — Setup & Deployment Guide

> Complete guide for local development, production deployment, and database administration.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development Setup](#2-local-development-setup)
3. [Environment Variables (.env)](#3-environment-variables-env)
4. [Database Access](#4-database-access)
5. [Production Deployment (VPS / Docker)](#5-production-deployment-vps--docker)
6. [Folder Permissions & Storage Paths](#6-folder-permissions--storage-paths)
7. [JWT Secret Management](#7-jwt-secret-management)
8. [Docker Volume Mapping](#8-docker-volume-mapping)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| .NET SDK | 8.0+ | Backend API |
| Node.js | 18+ | Frontend build (Vite) |
| Docker & Docker Compose | Latest | PostgreSQL, containers |
| Git | Latest | Source control |

Optional:
- **DBeaver** or **pgAdmin** for database browsing
- **OpenSSL** for generating JWT secrets (`openssl rand -base64 48`)

---

## 2. Local Development Setup

### Step 1 — Clone & prepare environment

```bash
git clone <your-repo-url> ResourceManager
cd ResourceManager
cp .env.example .env
# Edit .env — fill in POSTGRES_PASSWORD and JWT_KEY at minimum
```

### Step 2 — Start PostgreSQL + pgAdmin (Docker)

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:
| Service | URL / Port | Credentials |
|---------|-----------|-------------|
| PostgreSQL | `localhost:5432` | `rmuser` / `DevPassword123!` (DB: `resourcemanager_dev`) |
| pgAdmin 4 | `http://localhost:5050` | `admin@resourcemanager.com` / `admin123` |

### Step 3 — Apply database migrations

```bash
dotnet ef database update
```

> If `dotnet ef` is not installed: `dotnet tool install --global dotnet-ef`

### Step 4 — Start the backend API

```bash
dotnet run
```

The API starts on `https://localhost:7175` (or the port configured in `launchSettings.json`).

### Step 5 — Start the frontend

```bash
cd ClientApp
npm install
npm run dev
```

The React app starts on `http://localhost:5173` and proxies API calls to the backend.

### Step 6 — Test login

Use the default test account:
- **Email**: `AHT@gmail.com`
- **Password**: `AHT@gmail.com`

---

## 3. Environment Variables (.env)

Create a `.env` file in the project root (never commit it). See `.env.example` for the full template.

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `resourcemanager` |
| `POSTGRES_USER` | Database user | `rmuser` |
| `POSTGRES_PASSWORD` | Database password | *(strong random password)* |
| `JWT_KEY` | JWT signing key (min 32 chars) | *(use `openssl rand -base64 48`)* |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_ISSUER` | JWT issuer claim | `ResourceManager` |
| `JWT_AUDIENCE` | JWT audience claim | `ResourceManager-Users` |
| `JWT_EXPIRATION` | Access token lifetime (minutes) | `15` |
| `GOOGLE_CLIENT_ID` | Gmail API client ID (for email sending) | *(empty)* |
| `GOOGLE_CLIENT_SECRET` | Gmail API client secret | *(empty)* |
| `GOOGLE_REFRESH_TOKEN` | Gmail API refresh token | *(empty)* |
| `WEB_PORT` | Frontend port (production) | `80` |

### How .env loading works

The backend (`Program.cs`) automatically loads the `.env` file at startup:
1. Reads each line, skips comments (`#`) and empty lines
2. Splits on the first `=` sign
3. Sets environment variables **only if not already defined** (system env vars take precedence)

This means you can override `.env` values with system environment variables or Docker `environment:` entries.

---

## 4. Database Access

This section covers **every step** to connect to the database in both development and production.

---

### A. Development — Direct Connection (No Tunnel Needed)

When you run `docker compose -f docker-compose.dev.yml up -d`, PostgreSQL is exposed on **port 5432** of your machine. You connect directly.

#### Dev Database Credentials

| Field      | Value                 |
|------------|-----------------------|
| Host       | `localhost`           |
| Port       | `5432`                |
| Database   | `resourcemanager_dev` |
| Username   | `rmuser`              |
| Password   | `DevPassword123!`     |

> These come from `docker-compose.dev.yml`. If you changed them in `.env`, use those values.

---

#### Method 1: pgAdmin (opens in browser — zero install)

pgAdmin starts automatically with the dev Docker Compose file.

**Step 1** — Open your browser and go to:

```
http://localhost:5050
```

**Step 2** — Log in with these credentials:

| Field    | Value                        |
|----------|------------------------------|
| Email    | `admin@resourcemanager.com`  |
| Password | `admin123`                   |

**Step 3** — The dev database is already pre-configured. In the **left sidebar**, expand this path:

```
Servers
  └── ResourceManager Dev
       └── Databases
            └── resourcemanager_dev
                 └── Schemas
                      └── public
                           └── Tables
```

If it asks for a password when connecting, enter: `DevPassword123!`

**Step 4** — To run a SQL query:

1. Right-click on `resourcemanager_dev`
2. Click **Query Tool**
3. Type your SQL in the editor panel
4. Click the ▶ **Execute** button (or press `F5`)

```sql
-- Example: see all invoices
SELECT * FROM "Invoices" LIMIT 10;

-- Example: count clients
SELECT COUNT(*) FROM "Clients";

-- Example: list all tables
SELECT tablename FROM pg_tables WHERE schemaname = 'public';
```

> **Important**: PostgreSQL table names are case-sensitive when quoted. EF Core creates tables with PascalCase names like `"Invoices"`, `"Clients"`, `"UserProfiles"`. Always wrap them in **double quotes**.

---

#### Method 2: DBeaver (desktop database manager)

**Step 1** — Download and install DBeaver from [dbeaver.io/download](https://dbeaver.io/download/).

**Step 2** — Open DBeaver. In the main toolbar, click the **plug icon** or go to **Database → New Database Connection**.

**Step 3** — A dialog appears. Select **PostgreSQL** from the list. Click **Next**.

**Step 4** — Fill in the **Main** tab exactly like this:

| Field    | What to type          |
|----------|-----------------------|
| Host     | `localhost`           |
| Port     | `5432`                |
| Database | `resourcemanager_dev` |
| Username | `rmuser`              |
| Password | `DevPassword123!`     |

Check the box **"Save password locally"** so you don't have to re-enter it every time.

**Step 5** — Click the **"Test Connection..."** button at the bottom-left.

- If it says **"Connected"** with a green checkmark — you're good.
- If it asks to **download the PostgreSQL JDBC driver** — click **Download**. Wait for it to finish. Then click **Test Connection** again.
- If it shows **"Connection refused"** — check that Docker is running: `docker compose -f docker-compose.dev.yml ps`

**Step 6** — Click **Finish**. The connection now appears in the **Database Navigator** panel on the left.

**Step 7** — To browse tables: Expand the tree:
```
resourcemanager_dev → Schemas → public → Tables
```
Double-click any table to see its data.

**Step 8** — To run a SQL query:
1. Right-click the `resourcemanager_dev` database in the navigator
2. Click **SQL Editor → New SQL Script**
3. Type your query
4. Press `Ctrl+Enter` to execute (or click the green play button)

---

#### Method 3: psql (command line)

**Option A** — If `psql` is installed on your machine:

```bash
psql -h localhost -p 5432 -U rmuser -d resourcemanager_dev
```

When prompted, enter the password: `DevPassword123!`

**Option B** — If `psql` is NOT installed, run it from inside the Docker container (no install needed):

```bash
docker compose -f docker-compose.dev.yml exec postgres_dev psql -U rmuser -d resourcemanager_dev
```

This drops you directly into the SQL prompt. Useful commands:

```sql
\dt                            -- List all tables
\d "Invoices"                  -- Describe the Invoices table (columns, types)
SELECT * FROM "Clients";       -- See all clients
SELECT COUNT(*) FROM "Invoices"; -- Count invoices
\q                             -- Quit psql
```

---

### B. Production — SSH Tunnel (Required)

In production, PostgreSQL is **NOT exposed** to the internet. The `docker-compose.yml` deliberately does not map port 5432 to the host machine. This means you **cannot** connect directly from your PC to the production database.

Instead, you create an **SSH tunnel** — a secure, encrypted connection from your PC, through the VPS server, into the Docker network where PostgreSQL is running.

#### How the tunnel works (visual):

```
┌──────────────┐         SSH (port 22)        ┌──────────────────┐      Docker network      ┌────────────────┐
│  Your PC     │ ────────────────────────────▶ │  VPS Server      │ ──────────────────────▶  │  postgres_db   │
│  localhost   │                               │  85.214.180.48   │                          │  port 5432     │
│  port 5433   │◀── encrypted tunnel ────────▶ │                  │◀── internal only ──────▶ │                │
└──────────────┘                               └──────────────────┘                          └────────────────┘
```

Your PC connects to `localhost:5433`. SSH forwards that traffic through the VPS into the Docker container's port 5432.

---

#### Before you start — gather this information

| What you need               | Example value             | Where to find it                         |
|-----------------------------|---------------------------|------------------------------------------|
| VPS IP address              | `85.214.180.48`           | Your hosting provider dashboard          |
| SSH username                | `root` or `deploy`        | Your server setup / hosting provider     |
| SSH port                    | `22` (usually default)    | Your server config, or try `22`          |
| SSH authentication          | Password or SSH key file  | Depends on how you set up your server    |
| SSH key file (if using key) | `C:\Users\you\.ssh\id_rsa` or `~/.ssh/id_rsa` | Your local `.ssh` folder |
| Production DB password      | *(from `.env` on server)* | Read it from the server (see below)      |
| Production DB name          | `resourcemanager`         | Same `.env` file on server               |
| Production DB user          | `rmuser`                  | Same `.env` file on server               |

**How to find the production database password:**

```bash
# SSH into your server first
ssh root@85.214.180.48

# Then read the .env file
cat /opt/resourcemanager/.env | grep POSTGRES_PASSWORD

# Output example:
# POSTGRES_PASSWORD=xK9mP2qL7wN4vR8t
```

Write down the password. You'll need it in the steps below.

---

#### Method 1: Command Line SSH Tunnel (quickest)

This method uses two terminal windows.

**Terminal 1 — Open the SSH tunnel** (run this on YOUR local machine, not the server):

```bash
ssh -L 5433:localhost:5432 root@85.214.180.48
```

Explanation of each part:
| Part | Meaning |
|------|---------|
| `ssh` | Start an SSH connection |
| `-L 5433:localhost:5432` | Forward your local port `5433` to the remote `localhost:5432` (PostgreSQL inside Docker) |
| `root@85.214.180.48` | SSH user and server IP (replace with yours) |

> **Why port 5433 instead of 5432?** If you also run PostgreSQL locally for development, port 5432 is already taken. Using 5433 avoids conflicts. You can use any free port (e.g., `15432`, `5555`).

After running this command:
- If using **password auth**: type your SSH password and press Enter
- If using **SSH key auth**: it connects automatically (or asks for the key passphrase)
- You'll see the server's terminal prompt — **keep this window open**. The tunnel stays active as long as this SSH session is running.

**Terminal 2 — Connect to the database** (open a **new** terminal):

```bash
psql -h localhost -p 5433 -U rmuser -d resourcemanager
```

When prompted, enter the **production** database password (the one from `.env` on the server, NOT `DevPassword123!`).

You're now connected to the production database. Run any SQL query:

```sql
SELECT COUNT(*) FROM "Invoices";
SELECT * FROM "Clients" LIMIT 5;
\q   -- quit when done
```

**When finished:** Close Terminal 2, then close Terminal 1 (type `exit` or press `Ctrl+D`). The tunnel closes automatically.

---

#### Method 2: DBeaver with Built-in SSH Tunnel (recommended for daily use)

DBeaver can create the SSH tunnel automatically — no separate terminal needed. You set it up once and just double-click to connect.

**Step 1** — Open DBeaver → **Database** menu → **New Database Connection**.

**Step 2** — Select **PostgreSQL** → Click **Next**.

**Step 3** — Fill in the **Main** tab:

| Field    | What to type           |
|----------|------------------------|
| Host     | `localhost`            |
| Port     | `5432`                 |
| Database | `resourcemanager`      |
| Username | `rmuser`               |
| Password | *(production password from .env on server)* |

> Use port **5432** here (not 5433). DBeaver's built-in SSH tunnel handles the forwarding internally, so the "Main" tab describes the connection from the VPS's perspective.

Check **"Save password locally"**.

**Step 4** — Click the **SSH** tab at the top of the dialog.

| Field              | What to enter                                      |
|--------------------|----------------------------------------------------|
| Use SSH Tunnel     | **Check this checkbox**                            |
| Host/IP            | Your VPS IP (e.g., `85.214.180.48`)                |
| Port               | `22`                                               |
| Username           | Your SSH user (e.g., `root` or `deploy`)           |
| Authentication     | Choose **Password** or **Public Key**              |
| *(If Password)*    | Enter your SSH password                            |
| *(If Public Key)*  | Click **Browse...** and select your private key file (e.g., `C:\Users\you\.ssh\id_rsa`) |
| Passphrase         | *(only if your SSH key has a passphrase)*          |

**Step 5** — Click **"Test Tunnel..."** → You should see: **"Tunnel is OK"**

If not:
- `Connection refused`: Check that port 22 is open on your VPS firewall
- `Auth fail`: Double-check SSH username and password/key
- `Timeout`: Verify the VPS IP is correct and the server is running

**Step 6** — Go back to the **Main** tab → Click **"Test Connection..."** → Should show **"Connected"**

If not:
- Check the database name (use `resourcemanager` for production, not `resourcemanager_dev`)
- Check the database password (production `.env` value)

**Step 7** — Click **Finish**.

The connection now appears in your Database Navigator. From now on, just **double-click** it — DBeaver automatically opens the SSH tunnel and connects to the database.

---

#### Method 3: pgAdmin with SSH Tunnel

**Step 1** — Open pgAdmin → In the left panel, right-click **Servers** → **Register** → **Server...**

**Step 2** — **General** tab:

| Field | What to enter           |
|-------|-------------------------|
| Name  | `ResourceManager Prod`  |

**Step 3** — **Connection** tab:

| Field              | What to enter                                |
|--------------------|----------------------------------------------|
| Host name/address  | `localhost`                                  |
| Port               | `5432`                                       |
| Maintenance database | `resourcemanager`                          |
| Username           | `rmuser`                                     |
| Password           | *(production password from .env on server)*  |
| Save password      | Toggle ON                                    |

**Step 4** — **SSH Tunnel** tab:

| Field                | What to enter                                |
|----------------------|----------------------------------------------|
| Use SSH tunneling    | **Toggle ON**                                |
| Tunnel host          | Your VPS IP (e.g., `85.214.180.48`)          |
| Tunnel port          | `22`                                         |
| Username             | Your SSH user (e.g., `root`)                 |
| Authentication       | **Password** or **Identity file**            |
| Password / Key file  | *(your SSH credentials)*                     |

**Step 5** — Click **Save**. pgAdmin opens the tunnel and connects.

Navigate: `ResourceManager Prod → Databases → resourcemanager → Schemas → public → Tables`

---

#### SSH Tunnel Troubleshooting

| Problem | What it means | How to fix |
|---------|---------------|------------|
| `Connection refused` when opening tunnel | Port 22 is blocked on the VPS | Run `sudo ufw allow 22` on the server, or check your hosting firewall settings |
| `Permission denied (publickey)` | SSH key is wrong or not accepted | Verify key path: `ssh -i C:\Users\you\.ssh\id_rsa root@your-ip`. Or try password auth instead. |
| `Connection refused` on port 5432 after tunnel opens | PostgreSQL container is not running | SSH into server and run `docker compose ps` to check. Restart with `docker compose up -d` |
| `FATAL: password authentication failed for user "rmuser"` | Wrong database password | Re-read the production `.env`: `cat /opt/resourcemanager/.env \| grep POSTGRES_PASSWORD` |
| `could not connect to server: Connection timed out` | VPS is unreachable | Ping the server: `ping 85.214.180.48`. Check if the server is running in your hosting dashboard. |
| Tunnel works but DBeaver shows no tables | Wrong database name selected | Make sure you typed `resourcemanager` (not `resourcemanager_dev` or `postgres`) |
| pgAdmin SSH tunnel fails on Windows | OpenSSH client not installed | Go to: **Settings → Apps → Optional Features → Add a feature → OpenSSH Client → Install** |
| `bind: Address already in use` when opening tunnel | Port 5433 is already taken | Use a different port: `ssh -L 5555:localhost:5432 root@your-ip`, then connect on port `5555` |

---

#### Why SSH Tunnel Instead of Exposing the Port?

Exposing port 5432 directly to the internet means **anyone** can try to connect to your database. Even with a strong password, this is risky:

| Risk | Mitigation via SSH Tunnel |
|------|---------------------------|
| Brute-force password attacks | Only users with SSH access can reach the DB |
| Unencrypted data in transit | SSH encrypts all traffic automatically |
| Accidental misconfiguration of `pg_hba.conf` | Irrelevant — the port isn't exposed at all |
| Port scanning reveals PostgreSQL | Port 5432 is invisible from the internet |
| No audit trail of who connected | SSH logins are logged in `/var/log/auth.log` |

**Bottom line**: SSH tunneling gives you the same access as a direct connection, but with full encryption and authentication — at zero extra cost.

---

## 5. Production Deployment (VPS / Docker)

### Step 1 — Prepare the server

```bash
# Install Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

### Step 2 — Upload project files

```bash
scp -r . user@your-vps-ip:/opt/resourcemanager
# Or use git clone on the server
```

### Step 3 — Create `.env` on the server

```bash
cd /opt/resourcemanager
cp .env.example .env
nano .env
```

**Critical**: Set strong values for:
- `POSTGRES_PASSWORD` — use `openssl rand -base64 24`
- `JWT_KEY` — use `openssl rand -base64 48` (must be ≥32 chars)
- `CORS` origins — set to your actual domain

### Step 4 — Build and start

```bash
# Build images
docker compose build

# Start all services (detached)
docker compose up -d

# Verify all containers are healthy
docker compose ps
```

### Step 5 — Apply migrations (first deploy only)

```bash
# Run migrations inside the API container
docker compose exec api dotnet ef database update
# OR run from a one-off container:
docker compose run --rm api dotnet ef database update
```

### Step 6 — Verify

```bash
# Check API health
curl http://localhost:7175/health

# Check frontend
curl http://localhost:80

# View logs
docker compose logs -f api
docker compose logs -f web
```

### Updating the application

```bash
cd /opt/resourcemanager
git pull origin main
docker compose build
docker compose up -d
```

---

## 6. Folder Permissions & Storage Paths

### How Supplier Invoice Storage Works

When a manager clicks **"Sync to Local"**, the system downloads pending invoices from the database and writes them to disk using this folder structure:

```
{BaseStoragePath}/
  └── {CompanyName}/
      └── {Year}/
          └── {MM - MonthName}/
              └── {SupplierName}/
                  └── invoice.pdf
```

**Example:**
```
C:\ResourceManager\Storage\
  └── AHT_Consulting\
      └── 2026\
          └── 02 - February\
              └── Office_Depot\
                  └── facture_02_2026.pdf
```

### Setting the BaseStoragePath

1. Log in as a **Manager**
2. Go to **Settings** → **PDF Storage Configuration**
3. Enter the full path (e.g., `C:\ResourceManager\Storage` or `/opt/resourcemanager/storage`)
4. Save — the path is **locked** after saving (gray background + 🔒 badge)
5. Only a **SuperAdmin** can reset it via the Users page (gear icon → "Reset Settings")

### File System Permissions

#### Windows (local development)

The .NET process runs as your user account, so it typically has write access to any folder you choose under your user profile. Just ensure the folder exists or let the app create it (it calls `Directory.CreateDirectory`).

#### Linux / Docker (production)

The Docker container runs as `appuser` (UID 1001). If you mount a host volume for storage, ensure the host directory is writable:

```bash
# Create the storage directory on the host
sudo mkdir -p /opt/resourcemanager/storage
sudo chown 1001:1001 /opt/resourcemanager/storage
```

If using Docker volumes for storage, add to `docker-compose.yml`:

```yaml
services:
  api:
    volumes:
      - api-logs:/app/Logs
      - /opt/resourcemanager/storage:/app/Storage   # ← Add this
```

Then set `BaseStoragePath` in Settings to `/app/Storage`.

### Illegal Characters in File/Folder Names

The system automatically sanitizes all file and folder names using `SanitizeFileName()`:
- Replaces characters illegal on Windows (`< > : " / \ | ? *`) with underscores
- Replaces `..` sequences (path traversal protection)
- Trims trailing dots and spaces (Windows restriction)
- Handles duplicate file names by appending `_1`, `_2`, etc.

---

## 7. JWT Secret Management

### Key Requirements

- **Minimum 32 characters** (enforced at startup — the app will throw if shorter)
- Should be cryptographically random
- Must be consistent across all API instances (if scaling horizontally)

### Key Resolution Order

The backend resolves the JWT signing key in this order:

1. **Environment variable** `JWT_KEY` (highest priority)
2. **Configuration** `Jwt:Key` from `appsettings.json` / `appsettings.{Environment}.json`
3. If neither is set or the key is shorter than 32 chars → **startup fails with an error**

### Generating a Secure Key

```bash
# Linux / macOS
openssl rand -base64 48

# PowerShell (Windows)
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }) -as [byte[]])

# Or use any password generator that outputs 48+ random characters
```

### Where to Set the Key

| Environment | Method |
|-------------|--------|
| Local dev | `.env` file → `JWT_KEY=...` |
| Docker (production) | `.env` file or `docker compose` environment variable |
| CI/CD | GitHub Secrets → inject as env var |
| Azure / AWS | App Settings / Parameter Store |

---

## 8. Docker Volume Mapping

### Production Volumes (`docker-compose.yml`)

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `pgdata` | `/var/lib/postgresql/data` | PostgreSQL data (persistent) |
| `api-logs` | `/app/Logs` | Serilog log files |

### Development Volumes (`docker-compose.dev.yml`)

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `pgdata_dev` | `/var/lib/postgresql/data` | Dev PostgreSQL data |
| `pgadmin_data` | `/var/lib/pgadmin` | pgAdmin session/config data |

### Backing Up the Database

**🚀 NEW: Automated Backup Solution**

We now have a complete automated backup solution with compression, rotation, and cron scheduling!

**Quick Start:**
```bash
# 1. Make scripts executable
chmod +x scripts/*.sh

# 2. Setup daily automated backups (2 AM)
sudo scripts/setup-backup-cron.sh

# 3. Test manual backup
scripts/pg-backup.sh
```

**Features:**
- ✅ Daily automated backups via cron
- ✅ Compressed backups (gzip)
- ✅ Automatic rotation (keeps last 7 backups)
- ✅ Optional external storage support
- ✅ Easy restore with safety backup
- ✅ Integrity verification

**See [BACKUP_GUIDE.md](BACKUP_GUIDE.md)** for complete documentation or **[BACKUP_QUICKREF.md](BACKUP_QUICKREF.md)** for quick reference.

**Manual backup/restore:**
```bash
# Backup (old method, still works)
docker compose exec postgres_db pg_dump -U rmuser resourcemanager > backup_$(date +%Y%m%d).sql

# Restore (old method)
docker compose exec -T postgres_db psql -U rmuser -d resourcemanager < backup_20260210.sql

# Backup (new automated script - recommended)
scripts/pg-backup.sh

# Restore (new script with safety features)
scripts/pg-restore.sh backups/backup_resourcemanager_20260212_120000.sql.gz
```

### Resetting Development Data

```bash
# Stop containers AND delete volumes (all data lost)
docker compose -f docker-compose.dev.yml down -v

# Restart fresh
docker compose -f docker-compose.dev.yml up -d
dotnet ef database update
```

---

## 9. Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| `JWT_KEY` startup error | Ensure `JWT_KEY` in `.env` is ≥32 characters |
| `POSTGRES_PASSWORD not set` | Create `.env` file from `.env.example` |
| Database connection refused | Check if `docker compose -f docker-compose.dev.yml ps` shows healthy |
| Migrations fail | Ensure connection string matches running PostgreSQL instance |
| `BaseStoragePath` locked | Contact SuperAdmin to reset via Users page |
| Sync fails with permission error | Check folder ownership (`chown 1001:1001`) on Linux |
| Login returns 429 | Rate limited — wait 15 minutes or restart the API |
| CORS errors in browser | Add your frontend URL to `Cors:AllowedOrigins` in config |

### Viewing Logs

```bash
# API logs (Docker)
docker compose logs -f api

# API logs (local file)
cat Logs/log-$(date +%Y%m%d).txt

# PostgreSQL logs
docker compose logs -f postgres_db
```

### Health Checks

```bash
# API health endpoint
curl http://localhost:7175/health

# Database connectivity (inside API container)
docker compose exec api dotnet ef database update --dry-run
```

---

## Architecture Quick Reference

```
Browser → Nginx (port 80) → API (port 8080) → PostgreSQL (port 5432)
                                             → Local Disk (BaseStoragePath)
```

- **Multi-tenancy**: Every request carries a `CompanyId` claim in the JWT. `AppDbContext` applies global query filters automatically.
- **Auth flow**: Login → JWT access token (15 min, in-memory) + refresh token (7 days, HttpOnly cookie)
- **Refresh rotation**: Each refresh creates a new token family. Reuse of an old token invalidates the entire family (replay attack detection).

---

*Last updated: February 2026*
