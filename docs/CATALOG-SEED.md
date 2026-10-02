# Pre-launch catalog seed

Concrete plan so **name search works at launch** without Bright Data, Whiskybase scrape, Apify, or Chin Chin.

**Product stance:** curated thousands of well-presented refs (whisky, rum, gin, vodka, beer first), not an exhaustive whisky universe. No LLM-generated descriptions.

**Product rules (locked):**

- Live barcode: **OFF primary** → **UPCitemdb trial** fallback (**no API key**)
- App name / typeahead search: **local DB only**
- Nurse: ~**100** remote lookups / UTC day (self-throttle)
- Dump-first: **no live OFF API for bulk**
- No secrets in repo; French UI copy without em dashes

Related: [`DATABASE.md`](./DATABASE.md) §3 · [`CATALOG-NURSE.md`](./CATALOG-NURSE.md) · Ace `catalog:off-dump` · Ace `catalog:nurse`

---

## Strategy (two complementary paths)

| Path | Role | Source | Cadence |
|---|---|---|---|
| **A — OFF dump** | Volume seed (curated alcohol filter) | OFF Parquet/CSV → DuckDB filter → JSONL, or full JSONL gzip | One-shot on VPS before launch; optional refresh later |
| **B — EAN nurse** | Curated spirits / gaps OFF often misses | `resources/catalog/ean-nurse.txt` → local → OFF API → UPCitemdb trial | Daily batches of ≤100 remote calls until list exhausted |

```text
Parquet/CSV ──► DuckDB filter ──► alcohol.jsonl ──► catalog:off-dump
   or full JSONL.gz ───────────────────────────────► catalog:off-dump
                                                         │
                                                         ▼
                                              bottles + bottle_sources
                                                         ▲
EAN nurse (budgeted) ────────────────────────────────────┘
App search ──► SELECT local only (never remote typeahead)
```

Do **not** use the live OFF search API to fill autocomplete. Do **not** scrape Whiskybase / Chin Chin / Bright Data / Apify.

---

## A. Open Food Facts dump (primary volume)

### Licence and attribution

| Layer | Licence | Credit |
|---|---|---|
| Product data (names, brands, categories, …) | [ODbL](https://opendatacommons.org/licenses/odbl/) | Open Food Facts |
| Product photos | [CC-BY-SA](https://creativecommons.org/licenses/by-sa/3.0/) | Open Food Facts contributors |

**FR (UI / about):** `Données produits : Open Food Facts (licence ODbL). Photos : contributeurs Open Food Facts (licence CC-BY-SA).`

**FR court:** `Données et photos catalogue : Open Food Facts (ODbL / CC-BY-SA).`

Constants: `apps/api/app/services/catalog/catalog_attribution.ts`. Prefer telling OFF about reuse (`reuse@openfoodfacts.org`).

### Why not CI

Full JSONL gzip is multi-GB. Parquet is ~800MB but still too large for CI. Import runs on the **VPS** (or a fat ops machine) with Postgres pointed at `DB_*`. Unit tests cover the **filter + mapper + dedupe + mirror** with tiny fixtures only.

### Preferred download path (Parquet + DuckDB)

OFF publishes a simplified Parquet on Hugging Face (~800MB) and a CSV gzip (~0.9GB). Filtering with [DuckDB](https://duckdb.org/) CLI is faster than streaming the multi-GB JSONL, and keeps the Ace importer simple (JSONL in → Postgres).

```bash
sudo mkdir -p /var/lib/atasoif/off
cd /var/lib/atasoif/off

# Parquet (recommended when DuckDB is available)
curl -L --retry 5 --retry-delay 30 \
  -o food.parquet \
  'https://huggingface.co/datasets/openfoodfacts/product-database/resolve/main/food.parquet?download=true'

# Filter curated categories → JSONL for Ace
duckdb -c "
COPY (
  SELECT
    code,
    product_name,
    product_name_fr,
    brands,
    quantity,
    image_url,
    image_front_url,
    categories_tags,
    countries,
    countries_tags,
    origins,
    alcohol_100g
  FROM read_parquet('food.parquet')
  WHERE list_contains(CAST(categories_tags AS VARCHAR[]), 'en:whiskies')
     OR list_contains(CAST(categories_tags AS VARCHAR[]), 'en:rums')
     OR list_contains(CAST(categories_tags AS VARCHAR[]), 'en:gins')
     OR list_contains(CAST(categories_tags AS VARCHAR[]), 'en:vodkas')
     OR list_contains(CAST(categories_tags AS VARCHAR[]), 'en:beers')
     OR list_contains(CAST(categories_tags AS VARCHAR[]), 'en:alcoholic-beverages')
     OR list_contains(CAST(categories_tags AS VARCHAR[]), 'en:spirits')
) TO 'alcohol.jsonl' (FORMAT JSON);
"
```

If `categories_tags` is a string column in your Parquet build, use `categories_tags ILIKE '%en:whiskies%'` (same idea for the other tags) instead of `list_contains`.

**CSV alternative:**

```bash
curl -L -o en.openfoodfacts.org.products.csv.gz \
  https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz

duckdb -c "
COPY (
  SELECT * FROM read_csv('en.openfoodfacts.org.products.csv.gz', delim='\t', header=true, ignore_errors=true)
  WHERE categories_tags ILIKE '%en:whiskies%'
     OR categories_tags ILIKE '%en:rums%'
     OR categories_tags ILIKE '%en:gins%'
     OR categories_tags ILIKE '%en:vodkas%'
     OR categories_tags ILIKE '%en:beers%'
     OR categories_tags ILIKE '%en:alcoholic-beverages%'
) TO 'alcohol.jsonl' (FORMAT JSON);
"
```

DuckDB is an **ops** dependency (CLI on the VPS). We do **not** ship `duckdb` as an Adonis/Node runtime package: the Ace importer stays JSONL-only.

### Fallback: full JSONL gzip

```bash
curl -L --retry 5 --retry-delay 30 \
  -o openfoodfacts-products.jsonl.gz \
  https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz
```

Ace will stream and filter; slower, same result for curated tags.

### Filter (implemented)

`--profile=curated` (default):

- Include: `en:whiskies`, `en:rums`, `en:gins`, `en:vodkas`, `en:beers` (+ FR / whisky variants)
- Parents as needed: `en:alcoholic-beverages`, `en:spirits` when ABV / name signals spirit or beer
- Exclude non-alcoholic beer/wine tags; drop ABV ≤ 0 when tagged alcoholic
- Require usable barcode (8–14 digits) + product name

`--profile=full`: broader alcohol (wines, ciders, liqueurs, pastis, …) for later expansion. Not the MVP default.

### Name cleanup + dedupe (implemented)

- Clean noisy retail names (packs, lots, embedded volumes, promo prices) before upsert
- Dedupe on normalized **brand + name** so 70cl / 1L / multipacks collapse to the best-presented SKU (prefers photo + preferred volume: 70cl spirits, 33cl beer)
- Disable with `--no-dedupe` if you need every barcode SKU

### Image mirror (local disk + auth media route)

Storage for personal uploads (E2-T04 / `CELLAR_PHOTO_DIR`) is **not** the catalog OFF path. Catalog seed uses a dedicated directory:

| Env | Role |
|---|---|
| `CATALOG_IMAGE_STORAGE_PATH` | Local root, e.g. `/var/lib/atasoif/catalog-images` (persistent volume) |
| `CATALOG_IMAGE_PUBLIC_BASE_URL` | Optional. Default when empty: `/api/v1/media/off` |

Served at **`GET /api/v1/media/off/:name`** (auth + email verified), filename = `{barcode}.jpg` (etc.). Frontend already fetches `/api/…` with the bearer token.

```bash
sudo mkdir -p /var/lib/atasoif/catalog-images
# Bind-mount ownership must match the API container user (`USER atasoif` in the image).
# After mount: docker exec "$CID" id   then on host:
#   sudo chown -R <uid>:<gid> /var/lib/atasoif/catalog-images
# Dokploy env:
CATALOG_IMAGE_STORAGE_PATH=/var/lib/atasoif/catalog-images
# optional override:
# CATALOG_IMAGE_PUBLIC_BASE_URL=/api/v1/media/off
```

**Prefer mirror-from-DB** when bottles are already imported (no JSONL needed):

```bash
cd apps/api
# Pilot batch
node ace catalog:mirror-images --limit=100
# Resume / full (skips already mirrored photoUrl under /api/v1/media/off/)
node ace catalog:mirror-images
```

During a fresh dump you can still combine:

```bash
node ace catalog:off-dump --file=…/alcohol.jsonl --profile=curated --mirror-images
```

Without mirror env/path, `photoUrl` stays the OFF remote URL. Original OFF URL is kept in `attrs.offImageUrl` for attribution. Disk ballpark for ~11.5k curated fronts: often **~0.5–2 GB** (varies by JPEG size) — check `df -h` before a full run; use `--limit` for pilots.

### Import commands

```bash
# Prerequisites: migrate + category seed
bun run db:migrate
bun run db:seed

cd apps/api
# Smoke: parse/filter only (curated + dedupe)
node ace catalog:off-dump \
  --file=/var/lib/atasoif/off/alcohol.jsonl \
  --dry-run --limit=50

# Full persist
node ace catalog:off-dump \
  --file=/var/lib/atasoif/off/alcohol.jsonl \
  --profile=curated \
  --mirror-images

# Broader alcohol later
node ace catalog:off-dump --file=…jsonl.gz --profile=full

# Root shortcut
bun run catalog:off-dump -- --file=/var/lib/atasoif/off/alcohol.jsonl --dry-run --limit=20
```

Idempotent: re-run upserts by barcode / `(source, external_id)`. Use `--skip-lines` only as a coarse resume aid after an interrupted read; prefer re-run for correctness.

Dry-run and persist both log `byCategory` (counts per AlcoholCategory slug after dedupe) so you can sanity-check the mix before writing.

---

## Prod / Dokploy runbook (Anthony)

**Status (2026-09-30):** code E3.1–E3.2 is in the API image path (`catalog:off-dump` already ran nurse live on prod). Dump **not** executed yet — catalogue still ~64. This section is the safe ops path. **Do not** wipe the DB. Leave `RUN_MIGRATIONS` unset/`0`. Ask before multi-GB downloads if VPS disk is tight.

### Disk & layout (host VPS)

| Path | Role | Approx size |
|---|---|---|
| `/var/lib/atasoif/off/` | Parquet / filtered JSONL (host) | Parquet ~800MB · curated `alcohol.jsonl` usually tens–hundreds of MB |
| Full `openfoodfacts-products.jsonl.gz` | Fallback only | **multi-GB** — prefer Parquet+DuckDB |
| `/var/lib/atasoif/catalog-images/` | Optional `--mirror-images` | grows with SKU count |

```bash
# On the VPS host (SSH), not inside the API container
sudo mkdir -p /var/lib/atasoif/off /var/lib/atasoif/catalog-images
df -h /var/lib/atasoif
```

Install DuckDB CLI on the **host** if missing (`https://duckdb.org/` — not shipped in the API image).

### 1) Download + filter on the host

Use the Parquet + DuckDB block above → `/var/lib/atasoif/off/alcohol.jsonl`.

Prefer curated tags only. Spot-check:

```bash
wc -l /var/lib/atasoif/off/alcohol.jsonl
head -n 1 /var/lib/atasoif/off/alcohol.jsonl | python3 -m json.tool | head
```

### 2) Make the file visible to the API container

Dokploy Application `api` (container name pattern like `ta-soif-api-…`):

**Option A — volume mount (preferred):** Advanced / mounts → host `/var/lib/atasoif/off` → container `/var/lib/atasoif/off` (read-only OK for import). Redeploy once so the mount sticks.

**Option B — one-shot copy:**

```bash
# From VPS host — replace CONTAINER with current api container id/name from Dokploy Docker UI
docker cp /var/lib/atasoif/off/alcohol.jsonl CONTAINER:/tmp/alcohol.jsonl
```

### 3) Dry-run first (Dokploy terminal)

Same path as live nurse: Dokploy → Docker → Containers → `ta-soif-api-…` → Terminal (`/bin/sh`, cwd `/app`).

```sh
# Smoke parse/filter (no DB writes)
node ace catalog:off-dump \
  --file=/var/lib/atasoif/off/alcohol.jsonl \
  --dry-run --limit=50

# Full dry-run (still no upserts) — watch drafted + byCategory
node ace catalog:off-dump \
  --file=/var/lib/atasoif/off/alcohol.jsonl \
  --profile=curated \
  --dry-run
```

If using Option B: `--file=/tmp/alcohol.jsonl`.

Expect: `upserted=0`, non-zero `drafted`, sensible `byCategory` (whisky / rhum / beer / gin / vodka…). Re-run is safe once you persist (idempotent upsert).

### 4) Persist (after dry-run looks good)

```sh
# Without image mirror first (photos stay remote OFF URLs — OK for MVP volume)
node ace catalog:off-dump \
  --file=/var/lib/atasoif/off/alcohol.jsonl \
  --profile=curated
```

### 4b) Mirror images (after bottles exist)

Needs **persistent** volume + env (not `/tmp`):

| Dokploy | Value |
|---|---|
| Mount | host `/var/lib/atasoif/catalog-images` → container `/var/lib/atasoif/catalog-images` |
| Env | `CATALOG_IMAGE_STORAGE_PATH=/var/lib/atasoif/catalog-images` |

Redeploy **once** after adding the mount/env (accepts clearing container `/tmp` dump files — mirror-from-DB does not need JSONL).

```sh
df -h /var/lib/atasoif/catalog-images /tmp
# Pilot
node ace catalog:mirror-images --limit=100
# Full resume-safe
node ace catalog:mirror-images
```

Verify a few `photoUrl` start with `/api/v1/media/off/` and users/user_bottles counts unchanged.

### 5) Verify

```sh
node -e 'const { Client }=require("pg");(async()=>{const c=new Client({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_DATABASE});await c.connect();const r=await c.query("select count(*)::int as n from bottles");console.log("bottles",r.rows[0].n);const s=await c.query("select source, count(*)::int as n from bottle_sources group by 1 order by 1");console.log(s.rows);await c.end();})().catch(e=>{console.error(e.message);process.exit(1)})'
```

Then spot-check `GET /api/v1/catalog/bottles?q=heineken` (auth) / typeahead in `/cave/ajouter`.

### Safety checklist

- [ ] `RUN_MIGRATIONS` still unset/`0` — dump does **not** need migrate
- [ ] No `migration:fresh` / DB reset
- [ ] Dry-run before persist
- [ ] Prefer curated profile (not `full`) for first prod seed
- [ ] Skip `--mirror-images` until disk + volume ready
- [ ] Confirm free disk before Parquet or full JSONL.gz download
- [ ] Nurse daily budget already used today → wait until next UTC day for more nurse; dump is independent

### Ask Anthony before

- Downloading full JSONL.gz (multi-GB) instead of Parquet+DuckDB
- Enabling `--mirror-images` on prod without a sized volume
- Any destructive DB ops

---

## B. Curated EAN nurse (spirits gaps)

List: `apps/api/resources/catalog/ean-nurse.txt`

- `# REAL` — public retail EANs verified against OFF (prefer FR-market when tagged)
- `# PLACEHOLDER` — synthetic; dry-run only; replace before relying on hits

```bash
cd apps/api
node ace catalog:nurse --dry-run
node ace catalog:nurse --daily-limit=100 --delay-ms=1500
```

Details, env, resume state: [`CATALOG-NURSE.md`](./CATALOG-NURSE.md).

UPCitemdb trial base URL needs **no key**. Our throttle mirrors ~100 req/day.

---

## Suggested launch order (ops)

1. Create VPS Postgres + set `DB_*` (no secrets in git).
2. `migration:run` + `db:seed` (categories).
3. Download OFF Parquet (or JSONL) → DuckDB filter → `catalog:off-dump` (optional `--mirror-images`).
4. Run `catalog:nurse` daily until REAL EANs are exhausted / mostly cache or upserted.
5. Spot-check `GET /api/v1/catalog/bottles?q=` for FR brands (whisky, rhum, bière).
6. Show OFF attribution in app about / credits (FR string above).
7. Live barcode still falls through OFF → UPCitemdb for new scans.

---

## Out of scope (MVP)

- Bright Data / Apify / Whiskybase / Chin Chin / Barlist-style proprietary dump
- LLM-generated tasting notes or descriptions
- Exhaustive whisky (or spirits) universe
- Remote name search at query time
- Committing OFF dumps into the repo
- Paying UPCitemdb until trial budget is clearly insufficient
- Shipping DuckDB as a Node dependency

---

## Checks for implementers

| Check | Command |
|---|---|
| Nurse unit tests | `cd apps/api && node ace test --files=tests/unit/catalog_nurse_service.spec.ts` |
| OFF dump filter / mapper / dedupe / mirror | `cd apps/api && node ace test --files=tests/unit/catalog_off_dump_service.spec.ts` |
| Mirror-from-DB helpers | `cd apps/api && node ace test --files=tests/unit/catalog_mirror_service.spec.ts` |
| Parsers | `cd apps/api && node ace test --files=tests/unit/catalog_parsers.spec.ts` |
