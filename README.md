# UniSouk OpenCart Backend

NestJS backend for the UniSouk OpenCart integration assignment. It exposes a REST API under `/api/v1`, persists operational data in PostgreSQL, uses Redis/BullMQ for async work, and integrates with **OpenCart 3.x** for catalog, orders, and inventory.

> **First-time note:** OpenCart is **not** fully automated on first `docker compose up`. You must complete a **one-time browser setup** (install wizard, storage move, API user). This README documents exactly what to do.

## Stack

| Service | Purpose | Host URL (Docker Compose) |
| ------- | ------- | ------------------------- |
| **app** | NestJS API | http://localhost:3000/api/v1 |
| **opencart** | OpenCart 3.0.3.x store + admin + **UniSouk `api/unisouk/*` extension** | http://localhost:8081 |
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

Native OpenCart 3 API covers **orders** partially; product CRUD, order list, and stock APIs are provided by the **UniSouk custom extension** baked into the Docker OpenCart image — see [OpenCart custom extension](#opencart-custom-extension-apiunisouk) below.

### Step 8 — Verify the custom extension (before NestJS)

After login succeeds (step 6), confirm the `api/unisouk/*` routes respond with JSON — not HTML 404 or the install wizard.

```bash
export OC_BASE="http://localhost:8081"
export OC_USER="unisouk-api"
export OC_KEY="YOUR_API_KEY"

export OC_TOKEN=$(curl -s -X POST "$OC_BASE/index.php?route=api/login" \
  -d "username=$OC_USER" \
  -d "key=$OC_KEY" | jq -r '.api_token')

curl -s -X POST \
  "$OC_BASE/index.php?route=api/unisouk/products&api_token=$OC_TOKEN" \
  -d "page=1" \
  -d "limit=20"
```

**Success** — JSON with `"success": true` and `data.products` (array may be empty if no catalog seed yet).

Only after this passes should you test Nest endpoints such as `GET /api/v1/products`.

---

## OpenCart custom extension (`api/unisouk/*`)

OpenCart 3’s **native** catalog API supports login and order read/update (`api/login`, `api/order/info`, `api/order/history`, `api/order/edit`). It does **not** expose product CRUD, paginated order list, or stock management.

The **UniSouk custom PHP extension** fills that gap. It is **built into the Docker OpenCart image** on every `docker compose build` — no manual copy step after clone.

### Why it exists

| Assignment module | Native OC3 API | Custom extension |
| ----------------- | -------------- | ---------------- |
| Product list / CRUD / variants | Not available | `api/unisouk/products/*` |
| Order list + filters | Not available | `api/unisouk/orders` |
| Stock read / adjust / alerts | Not available | `api/unisouk/stock/*` |
| Order detail / history / status PATCH | Available | Uses native `api/order/*` (no extension) |

NestJS never calls OpenCart with raw axios from domain modules — all traffic goes through `OpenCartClient` (`src/integrations/opencart/`), which targets the routes below.

### Deployment (Docker)

| Item | Location |
| ---- | -------- |
| Extension source | `opencart-extension/catalog/controller/api/unisouk/` |
| Language files | `opencart-extension/catalog/language/en-gb/api/unisouk/` |
| Docker build | `docker/opencart/Dockerfile` (extends `aamservices/opencart:3.0.3.6`) |
| Compose service | `opencart` builds from that Dockerfile (`docker-compose.yml`) |
| Runtime path (container) | `/var/www/html/catalog/controller/api/unisouk/` |

Rebuild after changing extension PHP:

```bash
docker compose build opencart
docker compose up -d opencart
```

### Authentication

Same session model as native OpenCart API:

1. `POST api/login` with `username` + `key` → receive `api_token`
2. Pass `api_token` as a **query parameter** on every subsequent call
3. All extension endpoints use **POST** with `Content-Type: application/x-www-form-urlencoded`
4. Each controller checks `$this->session->data['api_id']` — unauthenticated calls return a permission error JSON

### Response envelope

```json
{ "success": true, "data": { ... } }
{ "error": "message" }
```

Nest `OpenCartMapper` normalizes these payloads into internal DTOs.

### Extension endpoints (full list)

All routes: `POST {OPENCART_BASE_URL}/index.php?route={route}&api_token={token}`

#### Products — `products.php`

| Route | Method | Body fields | Purpose |
| ----- | ------ | ----------- | ------- |
| `api/unisouk/products` | `index()` | `page`, `limit` | Paginated product list |
| `api/unisouk/products/info` | `info()` | `product_id` | Single product detail |
| `api/unisouk/products/add` | `add()` | `name`, `model`, `price`, `quantity`, optional `status`, `description` | Create product |
| `api/unisouk/products/edit` | `edit()` | `product_id` + fields to update | Update product |
| `api/unisouk/products/delete` | `delete()` | `product_id` | Delete product |
| `api/unisouk/products/options` | `options()` | `product_id` | List variants (option name, value, `option_value_id`, price modifier, quantity) |

**Product list response shape:**

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "product_id": 42,
        "name": "Wireless Mouse",
        "model": "WM-001",
        "price": 29.99,
        "quantity": 100,
        "status": 1,
        "description": "..."
      }
    ],
    "total": 5
  }
}
```

#### Orders — `orders.php`

| Route | Method | Body fields | Purpose |
| ----- | ------ | ----------- | ------- |
| `api/unisouk/orders` | `index()` | `page`, `limit`, optional `order_status_id`, `date_from`, `date_to` | Paginated order list with line items |

Each order includes `products[]` with `order_product_id`, `product_id`, `quantity`, `price`, and `option_value_id` / `option_value_ids` for variant lines.

#### Stock — `stock.php`

| Route | Method | Body fields | Purpose |
| ----- | ------ | ----------- | ------- |
| `api/unisouk/stock/info` | `info()` | `product_id`, optional `option_value_id` | Read base or variant quantity |
| `api/unisouk/stock/edit` | `edit()` | `product_id`, `quantity`, optional `option_value_id` | Set absolute stock level |
| `api/unisouk/stock/alerts` | `alerts()` | optional `threshold` (default 10) | Products below threshold |

**Stock errors:** setting quantity below zero returns `"Insufficient stock"` (Nest maps this to `INSUFFICIENT_STOCK`).

### Verify extension (curl checklist)

Run from your host against `http://localhost:8081` after steps 1–6 above.

```bash
export OC_BASE="http://localhost:8081"
export OC_USER="unisouk-api"
export OC_KEY="YOUR_API_KEY"

# 1. Login
curl -s -X POST "$OC_BASE/index.php?route=api/login" \
  -d "username=$OC_USER" \
  -d "key=$OC_KEY"

# 2. Save token
export OC_TOKEN=$(curl -s -X POST "$OC_BASE/index.php?route=api/login" \
  -d "username=$OC_USER" \
  -d "key=$OC_KEY" | jq -r '.api_token')

# 3. List products (extension)
curl -s -X POST \
  "$OC_BASE/index.php?route=api/unisouk/products&api_token=$OC_TOKEN" \
  -d "page=1" -d "limit=20"

# 4. Product detail (replace 42 with a real product_id)
curl -s -X POST \
  "$OC_BASE/index.php?route=api/unisouk/products/info&api_token=$OC_TOKEN" \
  -d "product_id=42"

# 5. Variants
curl -s -X POST \
  "$OC_BASE/index.php?route=api/unisouk/products/options&api_token=$OC_TOKEN" \
  -d "product_id=42"

# 6. Stock read
curl -s -X POST \
  "$OC_BASE/index.php?route=api/unisouk/stock/info&api_token=$OC_TOKEN" \
  -d "product_id=42"

# 7. Order list
curl -s -X POST \
  "$OC_BASE/index.php?route=api/unisouk/orders&api_token=$OC_TOKEN" \
  -d "page=1" -d "limit=20"

# 8. Low-stock alerts
curl -s -X POST \
  "$OC_BASE/index.php?route=api/unisouk/stock/alerts&api_token=$OC_TOKEN" \
  -d "threshold=10"

# 9. Native order detail (sanity — no extension)
curl -s -X POST \
  "$OC_BASE/index.php?route=api/order/info&api_token=$OC_TOKEN" \
  -d "order_id=1"
```

| Check | Pass if |
| ----- | ------- |
| Login | JSON contains `api_token` |
| List products | JSON `"success": true`, not HTML 404 |
| Permission error | JSON `error` about permission — fix token or IP allowlist |
| Install wizard HTML | OpenCart not configured — complete [first-time setup](#first-time-opencart-setup-manual-one-time) |

### NestJS mapping (what calls the extension)

| Nest route (JWT) | OpenCart route |
| ---------------- | -------------- |
| `GET /api/v1/products` | `api/unisouk/products` |
| `GET /api/v1/products/:id` | `api/unisouk/products/info` |
| `POST /api/v1/products` | `api/unisouk/products/add` |
| `PUT /api/v1/products/:id` | `api/unisouk/products/edit` |
| `DELETE /api/v1/products/:id` | `api/unisouk/products/delete` |
| `GET /api/v1/products/:id/variants` | `api/unisouk/products/options` |
| `GET /api/v1/orders` *(C-18)* | `api/unisouk/orders` |
| `GET /api/v1/inventory/*` *(C-19)* | `api/unisouk/stock/*` |

Further API contract detail: [`docs/opencart-api-notes.md`](docs/opencart-api-notes.md).

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
| Custom `api/unisouk/*` PHP extension | **Yes** — baked into OpenCart image via `docker/opencart/Dockerfile` |

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
| [`docs/opencart-api-notes.md`](docs/opencart-api-notes.md) | OpenCart version decision, native vs custom routes, status IDs, seed plan |
| [`opencart-extension/`](opencart-extension/) | UniSouk PHP extension source (`api/unisouk/*`) |
| [`docs/UNISOUK_OPENCART_COMMIT_TRACKER.md`](docs/UNISOUK_OPENCART_COMMIT_TRACKER.md) | Commit-by-commit implementation plan |
| [`docs/UNISOUK_OPENCART_MANUAL_TESTING_PLAN.md`](docs/UNISOUK_OPENCART_MANUAL_TESTING_PLAN.md) | Manual QA after each commit |

---

## License

UNLICENSED
