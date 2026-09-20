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

### Image mirror (scaffold)

Storage for personal uploads (E2-T04) is not the catalog path. Catalog seed uses a dedicated local directory:

| Env | Role |
|---|---|
| `CATALOG_IMAGE_STORAGE_PATH` | Local root, e.g. `/var/lib/atasoif/catalog-images` |
| `CATALOG_IMAGE_PUBLIC_BASE_URL` | Optional public prefix once static serving exists |

```bash
sudo mkdir -p /var/lib/atasoif/catalog-images
# in apps/api/.env
CATALOG_IMAGE_STORAGE_PATH=/var/lib/atasoif/catalog-images
# optional later:
# CATALOG_IMAGE_PUBLIC_BASE_URL=https://api.atasoif.fr/media/catalog

node ace catalog:off-dump --file=/var/lib/atasoif/off/alcohol.jsonl --mirror-images
```

Without `--mirror-images` (or without the env path), `photoUrl` stays the OFF remote URL. Prefer mirroring before launch so the app does not hotlink the OFF CDN. Original OFF URL is kept in `attrs.offImageUrl` for attribution.

Static HTTP serving of mirrored files is a follow-up (wire when Drive/R2 or Adonis static route lands).

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
| Parsers | `cd apps/api && node ace test --files=tests/unit/catalog_parsers.spec.ts` |
