# UniSouk — Reviewer Setup Guide (§6.4)

Step-by-step guide for evaluators to run the assignment backend against a local OpenCart store. Assumes you have cloned the repo and have Docker Desktop installed.

**Related:** [README.md](../README.md) (architecture, inventory sync) · [opencart-api-notes.md](./opencart-api-notes.md) (API routes)

---

## 1. URLs and default credentials

| Resource | URL / value |
| -------- | ----------- |
| Nest API | http://localhost:3000/api/v1 |
| Swagger | http://localhost:3000/api |
| Health | http://localhost:3000/health |
| OpenCart storefront | http://localhost:8081 |
| OpenCart admin | http://localhost:8081/admin |
| Admin username | `admin` |
| Admin password | `admin` _(from `docker-compose.yml` `OPENCART_ADMIN_PASSWORD`)_ |
| Nest JWT login | `admin` / `admin123` _(dev defaults — see `.env.example`)_ |
| OpenCart API user | `unisouk-api` _(create in §3; must match `OPENCART_API_USERNAME`)_ |

---

## 2. Start the stack

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

Wait until `app`, `worker`, `opencart`, `postgres`, and `redis` are healthy.

Verify Nest:

```bash
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

## 3. OpenCart API user and `.env`

1. Log in to **http://localhost:8081/admin** (`admin` / `admin`).
2. **System → Users → API → Add New**
3. Username: `unisouk-api`
4. **Generate** API key → copy it
5. **IP Addresses** tab → add `127.0.0.1` and `0.0.0.0` _(dev only)_
6. **Save**

Update `.env`:

```env
OPENCART_BASE_URL=http://opencart
OPENCART_API_USERNAME=unisouk-api
OPENCART_API_KEY=<paste-key-here>
```

Restart API and worker:

```bash
docker compose up -d app worker
```

Verify OpenCart login from host:

```bash
curl -X POST "http://localhost:8081/index.php?route=api/login" \
  -d "username=unisouk-api" \
  -d "key=YOUR_API_KEY"
```

Pass: JSON contains `"api_token"`.

---

## 4. Seeded catalog — products (5)

The default OpenCart 3.0.3.9 demo catalog ships with the Docker image. Use these **five product IDs** for assignment tests (verified against a live compose stack on 2026-07-10):

| Ref | `product_id` | Name | Model / SKU | Base qty | Variants | Test purpose |
| --- | ------------ | ---- | ----------- | -------- | -------- | ------------ |
| USQ-P001 | **28** | HTC Touch HD | Product 1 | 939 | — | Simple product — stock deduct |
| USQ-P002 | **30** | Canon EOS 5D | Product 3 | 7 | Select: Red (qty **2**), Blue (qty **5**) | **Variant deduct** — use `option_value_id` **15** (Red) or **16** (Blue) |
| USQ-P003 | **29** | Palm Treo Pro | Product 2 | 999 | — | Simple product — multi-line orders |
| USQ-P004 | **42** | Apple Cinema 30" | Product 15 | 1000 | 11 option values | Multi-option product |
| USQ-P005 | **49** | Samsung Galaxy Tab 10.1 | SAM1 | **0** | — | Zero stock — alerts / insufficient-stock sync |

### Verify products via Nest

```bash
export TOKEN="<jwt-from-login>"

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/products/28
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/products/30/variants
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/inventory/49
```

### Optional: confirm IDs in MySQL

```bash
docker compose exec opencart-db mysql -uopencart -popencart opencart \
  -e "SELECT p.product_id, pd.name, p.model, p.quantity FROM oc_product p \
      JOIN oc_product_description pd ON p.product_id = pd.product_id AND pd.language_id = 1 \
      WHERE p.product_id IN (28,29,30,42,49) ORDER BY p.product_id;"
```

---

## 5. Seeded catalog — orders (3)

**Create these three orders in OpenCart admin** (**Sales → Orders → Add**). On a fresh store with no prior orders, OpenCart assigns IDs **1**, **2**, and **3** sequentially.

| Ref | `order_id` | Initial status | Line items | Purpose |
| --- | ---------- | -------------- | ---------- | ------- |
| USQ-O001 | **1** | Pending (`order_status_id=1`) | 2× product **28**, 1× product **29** | E2E: PATCH → `processing` → async stock deduct |
| USQ-O002 | **2** | Pending | 1× product **30**, option **Red** (`option_value_id=15`) | Variant-level stock deduct |
| USQ-O003 | **3** | Pending | 5× product **30**, option **Red** | Insufficient stock (only 2 Red in stock) — sync job should fail |

### Admin order creation tips

1. **Sales → Orders → Add** → add customer (or guest) → add products from table above.
2. For **USQ-O002** / **USQ-O003**: when adding product **30**, select option **Red** in the order line.
3. Set **Order Status** to **Pending** before saving.
4. Note the assigned **order ID** in the order list — should be 1, 2, 3 if these are the first orders.

### Verify orders via Nest

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/orders?status=pending"

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/orders/1
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/orders/2
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/orders/3
```

Each order detail should include `lineItems` with `productId`, `quantity`, and (for order 2/3) variant option data.

---

## 6. Inventory sync smoke test

Uses **USQ-O001** (`order_id=1`):

```bash
# Stock before
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/inventory/28
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/inventory/29

# Trigger sync
curl -s -X PATCH "http://localhost:3000/api/v1/orders/1/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"processing"}'

# Wait a few seconds, then re-check stock (28 should −2, 29 should −1)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/inventory/28
```

Check worker logs: `docker compose logs -f worker`

Check sync job row:

```bash
docker compose exec postgres psql -U postgres -d open_cart_assignment \
  -c "SELECT order_id, status, error_code FROM inventory_sync_jobs WHERE order_id = 1;"
```

---

## 7. Environment variables

Copy [`.env.example`](../.env.example) to `.env`. Key values for Docker Compose:

| Variable | Docker value | Notes |
| -------- | ------------ | ----- |
| `OPENCART_BASE_URL` | `http://opencart` | Service name inside compose network |
| `OPENCART_API_USERNAME` | `unisouk-api` | Must match admin API user |
| `OPENCART_API_KEY` | _(from admin)_ | Required |
| `REDIS_HOST` | `redis` | BullMQ |
| `DATABASE_HOST` | `postgres` | Overridden in compose for `app`/`worker` |
| `JWT_SECRET` | _(optional in dev)_ | Required in production |
| `API_USER` / `API_PASSWORD_HASH` | _(optional in dev)_ | Dev defaults: `admin` / `admin123` |

Full variable reference: comments in `.env.example`.

---

## 8. Troubleshooting

| Symptom | Fix |
| ------- | --- |
| OpenCart `error.ip` on login | Add IP to API user allowlist |
| Nest `502` on products/orders | Check `OPENCART_API_KEY`; verify extension: `api/unisouk/products` |
| Order PATCH 200 but stock unchanged | Ensure `worker` container is running (`docker compose ps worker`) |
| Product/order ID not found | Re-run §4–§5 verification queries; IDs differ if catalog was reset (`docker compose down -v`) |

After `docker compose down -v`, repeat OpenCart install, API user setup, and order creation — product IDs may change.

---

## 9. Quick reference — entity IDs

| Entity | IDs |
| ------ | --- |
| Products | **28**, **29**, **30**, **42**, **49** |
| Orders | **1**, **2**, **3** _(after creating §5 orders on fresh store)_ |
| Variant (`product_id=30`, Red) | `option_value_id` **15** |
