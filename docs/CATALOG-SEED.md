# Pre-launch catalog seed

Concrete plan so **name search works at launch** without Bright Data, Whiskybase scrape, or Chin Chin.

**Product rules (locked):**

- Live barcode: **OFF primary** → **UPCitemdb trial** fallback (**no API key**)
- App name / typeahead search: **local DB only**
- Nurse: ~**100** remote lookups / UTC day (self-throttle)
- No secrets in repo; French UI copy without em dashes

Related: [`DATABASE.md`](./DATABASE.md) §3 · [`CATALOG-NURSE.md`](./CATALOG-NURSE.md) · Ace `catalog:off-dump` · Ace `catalog:nurse`

---

## Strategy (two complementary paths)

| Path | Role | Source | Cadence |
|---|---|---|---|
| **A — OFF dump** | Volume seed (beer, wine, many food-alcohol SKUs) | Open Food Facts nightly JSONL | One-shot on VPS before launch; optional refresh later |
| **B — EAN nurse** | Curated spirits / gaps OFF often misses | `resources/catalog/ean-nurse.txt` → local → OFF API → UPCitemdb trial | Daily batches of ≤100 remote calls until list exhausted |

```text
OFF dump  ──►  bottles + bottle_sources (source=openfoodfacts)
                 ▲
                 │ cache hits free
EAN nurse ───────┴──► miss: OFF live → UPCitemdb (budgeted) → upsert
App search ──► SELECT local only (never remote typeahead)
```

Do **not** use the live OFF search API to fill autocomplete. Do **not** scrape Whiskybase / Chin Chin / Bright Data.

---

## A. Open Food Facts dump (primary volume)

### Licence

Contains data from [Open Food Facts](https://world.openfoodfacts.org/), available under the [Open Database License](https://opendatacommons.org/licenses/odbl/). Attribute OFF in product UI / about when you ship catalog data publicly. Prefer telling OFF about reuse (`reuse@openfoodfacts.org`).

### Why not CI

Full JSONL gzip is multi-GB. Import runs on the **VPS** (or a fat ops machine) with Postgres pointed at `DB_*`. Unit tests cover the **filter + mapper** with tiny fixtures only.

### Download (VPS)

```bash
sudo mkdir -p /var/lib/atasoif/off
cd /var/lib/atasoif/off

# Nightly JSONL (~several GB compressed). Prefer curl -L and leave overnight if needed.
curl -L --retry 5 --retry-delay 30 \
  -o openfoodfacts-products.jsonl.gz \
  https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz

# Optional integrity: https://static.openfoodfacts.org/data/gz-sha256sum
```

Alternative formats (same filter ideas): CSV / Parquet on [OFF data page](https://world.openfoodfacts.org/data). This repo implements **JSONL (+ gzip)** first.

### Filter (implemented)

Ace importer keeps rows that look like alcoholic beverages:

- Include tags such as `en:alcoholic-beverages`, `en:beers`, `en:wines`, `en:spirits`, `en:whiskies`, `en:rums`, `en:gins`, `en:vodkas`, `en:cognacs`, `en:liqueurs`, `en:champagnes`, `en:ciders`, `en:pastis`, FR equivalents, …
- Exclude `en:non-alcoholic-beers` / alcohol-free wine tags; drop ABV ≤ 0 when tagged as beer/wine alcohol
- Require a usable barcode (8–14 digits) + product name
- Upsert via the same `CatalogLookupService.persistDraft` path as live barcode (`Bottle` + `BottleSource`, `source=openfoodfacts`)

### Import commands

```bash
# Prerequisites: migrate + category seed
bun run db:migrate
bun run db:seed

cd apps/api
# Smoke: parse/filter only
node ace catalog:off-dump \
  --file=/var/lib/atasoif/off/openfoodfacts-products.jsonl.gz \
  --dry-run --limit=50

# Full persist (long running)
node ace catalog:off-dump \
  --file=/var/lib/atasoif/off/openfoodfacts-products.jsonl.gz

# Root shortcut
bun run catalog:off-dump -- --file=/var/lib/atasoif/off/openfoodfacts-products.jsonl.gz --dry-run --limit=20
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
3. Download OFF JSONL → `catalog:off-dump` (overnight OK).
4. Run `catalog:nurse` daily until REAL EANs are exhausted / mostly cache or upserted.
5. Spot-check `GET /api/v1/catalog/bottles?q=` for FR brands (whisky, bière, vin).
6. Live barcode still falls through OFF → UPCitemdb for new scans.

---

## Out of scope

- Bright Data / Whiskybase / Chin Chin / Barlist-style proprietary dump
- Remote name search at query time
- Committing the multi-GB OFF dump into the repo
- Paying UPCitemdb until trial budget is clearly insufficient

---

## Checks for implementers

| Check | Command |
|---|---|
| Nurse unit tests | `cd apps/api && node ace test --files=tests/unit/catalog_nurse_service.spec.ts` |
| OFF dump filter / mapper tests | `cd apps/api && node ace test --files=tests/unit/catalog_off_dump_service.spec.ts` |
| Parsers | `cd apps/api && node ace test --files=tests/unit/catalog_parsers.spec.ts` |
