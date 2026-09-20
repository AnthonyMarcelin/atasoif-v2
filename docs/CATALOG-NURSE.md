# Catalog nurse (nourrice)

Pre-launch ops tool: walk a **curated EAN list**, fill catalog gaps before (or alongside) the OFF dump seed.

**Lookup order** (same as live barcode API): local DB → Open Food Facts → UPCitemdb → upsert `Bottle` + `BottleSource`.

See also: [`DATABASE.md`](./DATABASE.md) §3 · Ace command `catalog:nurse`.

---

## Prerequisites

1. Postgres up (`bun run docker:dev` or local DB) with migrations + category seed applied.
2. `apps/api/.env` copied from `.env.example` (catalog vars below).
3. **No UPCitemdb API key required** for the default trial endpoint.

---

## Environment

| Variable | Required | Default / notes |
|---|---|---|
| `OFF_API_BASE_URL` | yes | `https://world.openfoodfacts.org` |
| `OFF_USER_AGENT` | yes | Descriptive UA, e.g. `Atasoif/0.1 (hello@atasoif.local)` |
| `UPCITEMDB_ENABLED` | yes | `true` to allow nurse fallback |
| `UPCITEMDB_API_BASE_URL` | yes | **Trial (default):** `https://api.upcitemdb.com/prod/trial` → `GET …/lookup` ([Explorer trial lookup](https://www.upcitemdb.com/api/explorer#!/lookup/get_trial_lookup)). **Paid later:** `https://api.upcitemdb.com/prod/v1` |
| `UPCITEMDB_USER_KEY` | **no** for trial | Leave empty on trial. Optional later for paid plan / higher quota |
| `UPCITEMDB_KEY_TYPE` | no | Only sent when a user key is set (default `3scale`) |
| `CATALOG_NURSE_DAILY_LIMIT` | no | Our throttle for remote nurse lookups (default **100**/UTC day). Aligns with trial ~100 req/day; raise only if you move to paid |

Scaffold and local runs must **not** block on a missing `UPCITEMDB_USER_KEY`.

Documented in root `.env.example` and `apps/api/.env.example`.

---

## EAN list

Default file: `apps/api/resources/catalog/ean-nurse.txt`

- `# REAL` section: public retail barcodes (project tests / known SKUs)
- `# PLACEHOLDER` section: synthetic codes for dry-run scaffolding; replace before a real nurse pass
- One barcode per line (8–14 digits); `#` comments allowed

---

## How to run (local)

```bash
# From monorepo root
bun install
bun run db:migrate
bun run db:seed   # categories required for upserts

cd apps/api
cp .env.example .env   # if needed; leave UPCITEMDB_USER_KEY empty for trial

# Plan only (no HTTP to OFF/UPC, no DB writes from providers, no state write)
node ace catalog:nurse --dry-run

# Persist: cache hits free; cache misses call OFF then UPCitemdb (budgeted)
node ace catalog:nurse

# Smaller batch / custom budget
node ace catalog:nurse --limit=20 --daily-limit=50 --delay-ms=1500

# Or via package script
bun run catalog:nurse -- --dry-run
```

Root shortcut: `bun run catalog:nurse` (forwards args after `--`).

Resume: state file `apps/api/tmp/catalog-nurse-state.json` remembers completed EANs and today’s remote count (UTC day). Re-run skips completed rows unless `--force`. When the daily budget is hit, stop and continue the next day.

---

## How to run (VPS)

Same Ace command inside the API container / host Node runtime, with production `DB_*` and catalog env:

```bash
node ace catalog:nurse --daily-limit=100
```

Prefer cron or a manual ops session; do not scrape. Prefer OFF dump for volume (`DATABASE.md`); nurse only fills curated gaps.

---

## Rate limits

| Layer | Limit |
|---|---|
| Our nurse budget | `CATALOG_NURSE_DAILY_LIMIT` / `--daily-limit` (default 100 remote lookups / UTC day) |
| UPCitemdb trial | ~100 req/day (Explorer); no key |
| OFF live product API | Soft community limits; identify with `OFF_USER_AGENT`; nurse spaces calls with `--delay-ms` |

Cache hits never consume the nurse budget.
