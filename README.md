# UniSouk OpenCart Backend

NestJS backend for the UniSouk OpenCart integration assignment. It exposes a REST API under `/api/v1`, persists operational data in PostgreSQL, uses Redis/BullMQ for async work, and integrates with **OpenCart 3.x** for catalog, orders, and inventory.

> **First-time note:** OpenCart is **not** fully automated on first `docker compose up`. You must complete a **one-time browser setup** (install wizard, storage move, API user). This README documents exactly what to do.

## Stack

| Service | Purpose | Host URL (Docker Compose) |
| ------- | ------- | ------------------------- |
| **app** | NestJS API | http://localhost:3000/api/v1 |
| **opencart** | OpenCart 3.0.3.x store + admin | http://localhost:8081 |
| **postgres** | App database | internal only |
| **redis** | Queues / cache | internal only |
| **opencart-db** | MySQL for OpenCart | internal only |
| **worker** | BullMQ worker (placeholder until C-21) | n/a |

**Port note:** Compose maps OpenCart to **8081** on the host (`8081:80`) to avoid clashes with other local services. If your machine uses **8080** instead, check `ports` in `docker-compose.yml`.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Compose)
- [Node.js 20+](https://nodejs.org/) and [Yarn](https://yarnpkg.com/) (for local dev without Docker)
- A browser (for the one-time OpenCart install)

---

## Quick start (Docker)

### 1. Clone and configure env

```bash
git clone <repository-url>
cd open_cart_assignment
cp .env.example .env
```

Edit `.env` for local overrides. For Docker, the important OpenCart vars are set in `docker-compose.yml` — see [Wire Nest to OpenCart](#wire-nest-to-opencart-after-api-user-is-created) below.

### 2. Start the stack

```bash
docker compose up -d --build
```

Wait until services are up:

```bash
docker compose ps
```

### 3. Verify the Nest API

The API uses a global prefix — **`/` returns 404**; that is expected.

```bash
curl http://localhost:3000/api/v1
```

You should get a JSON envelope with the welcome message.

---

## First-time OpenCart setup (manual, one-time)

OpenCart ships as a fresh image with **no store configured**. The first person (or first fresh volume) must complete these steps in the browser. **Repeat only if you destroy the `opencart_db_data` volume.**

### Step 1 — Run the install wizard

1. Open **http://localhost:8081** (or your mapped host port).
2. You will be redirected to the **install wizard** (`/install/`).
3. Accept the license → pass pre-installation checks → reach **Configuration (step 3/4)**.

**Database connection** — use Docker service names, **not** `localhost`:

| Field | Value |
| ----- | ----- |
| DB Driver | MySQLi |
| Hostname | `opencart-db` |
| Username | `opencart` |
| Password | `opencart` |
| Database | `opencart` |
| Port | `3306` |
| Prefix | `oc_` (default) |

If that fails, try **Username** `root` / **Password** `opencart_root` (see `docker-compose.yml` → `opencart-db`).

**Administration** — choose your own admin login (for OpenCart admin only):

| Field | Example |
| ----- | ------- |
| Username | `admin` |
| Password | *(choose and save)* |
| E-Mail | your email |

4. Finish step 4 — you should see **Installation complete**.

### Step 2 — Delete the install directory (security)

OpenCart requires removing `/install` after setup:

```bash
docker compose exec opencart rm -rf /var/www/html/install
```

### Step 3 — Move storage (admin security modal)

1. Log in to **http://localhost:8081/admin** with your admin credentials.
2. On first login, OpenCart shows **Important Security Notification!** (move storage outside web root).
3. Choose **Automatically Move**, path **`/var/www/`** + **`storage`**, click **Move**.

### Step 4 — Create an OpenCart API user

The Nest app authenticates to OpenCart with an **API user**, not the admin password.

1. In admin: **System → Users → API → Add New**
2. Set **Username** (e.g. `unisouk-api`)
3. Click **Generate** for **Key** and **copy the key** (shown once)
4. Open the API user → **IP Addresses** tab → add allowed IPs:
   - `127.0.0.1` — curl/tests from your host
   - For local Docker dev, if login fails with an IP error, add `0.0.0.0` *(dev only)* or the app container’s IP on the compose network
5. **Save**

### Step 5 — Wire Nest to OpenCart

Set these in **`.env`** (and ensure `docker-compose.yml` `app` service picks them up):

```env
# From inside the app container, OpenCart is the compose service name:
OPENCART_BASE_URL=http://opencart

OPENCART_API_USERNAME=unisouk-api
OPENCART_API_KEY=<paste-generated-key-here>
```

Restart the app:

```bash
docker compose up -d app
```

### Step 6 — Verify OpenCart API login

From your **host** (use `localhost` and the **host** port, e.g. 8081):

```bash
curl -X POST "http://localhost:8081/index.php?route=api/login" \
  -d "username=unisouk-api" \
  -d "key=YOUR_API_KEY"
```

**Success** — JSON includes `"api_token"`:

```json
{
  "success": "...",
  "api_token": "..."
}
```

**Common failures:**

| Response | Fix |
| -------- | --- |
| `error.ip` — IP not allowed | Add your IP (or dev allowlist) under API user → IP Addresses |
| `error.key` — incorrect key | Regenerate key; update `.env` and restart `app` |
| Connection refused | Check `docker compose ps` — `opencart` must be running |

### Step 7 — Seed catalog data (assignment prep)

In OpenCart admin, create data for later integration tests (IDs go in `docs/SETUP.md` when that doc is added):

- **5 products** (Catalog → Products) — at least **one with options/variants**
- **3 orders** (Sales → Orders) — e.g. pending, for status/sync tests

Native OpenCart 3 API covers **orders** partially; product CRUD and stock APIs are documented as a planned custom extension — see [`docs/opencart-api-notes.md`](docs/opencart-api-notes.md).

---

## What is automated vs manual?

| Step | Automated on `docker compose up`? |
| ---- | --------------------------------- |
| Postgres, Redis, MySQL containers | Yes |
| Nest app build, migrations on start | Yes (`docker/entrypoint.sh`) |
| OpenCart install wizard | **No** — browser required (once per volume) |
| Storage move modal | **No** — browser required (once) |
| API user + IP allowlist | **No** — admin UI required (once) |
| Product/order seed data | **No** — admin UI (or future seed script) |
| Custom `api/unisouk/*` PHP extension | **Not yet** — planned in later commits |

---

## Running without Docker (local dev)

```bash
yarn install
cp .env.example .env
# Point DATABASE_* at local Postgres; OPENCART_BASE_URL=http://localhost:8081
yarn migrate:latest
yarn dev
```

API: http://localhost:3000/api/v1

> `yarn start:prod` expects `dist/src/main.js` after `yarn build` (Nest output layout).

---

## Docker commands

```bash
# Build and start
docker compose up -d --build

# Logs
docker compose logs -f app

# Stop
docker compose down

# Reset everything (including OpenCart DB — re-run manual install!)
docker compose down -v
```

---

## Database (Nest / PostgreSQL)

Migrations run automatically when the **app** container starts. Manual runs:

```bash
yarn migrate:latest
yarn migrate:rollback
yarn migrate:status
```

---

## Testing

```bash
yarn test
yarn test:e2e
```

---

## Related documentation

| Document | Purpose |
| -------- | ------- |
| [`docs/opencart-api-notes.md`](docs/opencart-api-notes.md) | OpenCart version decision, API routes, status IDs, seed plan |
| [`docs/UNISOUK_OPENCART_COMMIT_TRACKER.md`](docs/UNISOUK_OPENCART_COMMIT_TRACKER.md) | Commit-by-commit implementation plan |
| [`docs/UNISOUK_OPENCART_MANUAL_TESTING_PLAN.md`](docs/UNISOUK_OPENCART_MANUAL_TESTING_PLAN.md) | Manual QA after each commit |

---

## License

UNLICENSED
