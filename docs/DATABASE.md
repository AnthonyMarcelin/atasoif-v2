# Database & catalog plan

**Status:** locked decisions (ops still to execute)  
**Scope:** VPS Postgres targeting, Lucid schema evolution, catalog ingestion strategy, photo/freemium rules  
**Out of scope here:** actually creating the VPS database / roles (ops follow-up, not this PR)

Related: [`EPICS.md`](./EPICS.md) (E2 · **E3**) · [`SPRINTS.md`](./SPRINTS.md) (S2 · **S3**) · [`tickets/E2-memory-cellar.md`](./tickets/E2-memory-cellar.md) · [`DOCKER.md`](./DOCKER.md) · [`STACK-ADONIS.md`](./STACK-ADONIS.md)

---

## 1. VPS Postgres — dedicated database + app user

**Decision:** stop using a shared catch-all Postgres database for À ta soif. Provision a **dedicated database** and a **least-privilege app role** on the OVH VPS Postgres instance.

| Item | Rule |
|---|---|
| Database | Empty app DB for `atasoif` (name TBD in ops, e.g. `atasoif`) |
| Role | Dedicated app user with rights on that DB only (no superuser) |
| Schema apply | Adonis Lucid migrations via `node ace migration:run` / Compose entrypoint — **not** hand-written DDL in prod |
| Seed at create time | **None** — empty DB only (~5 minutes ops). Categories / catalog seed come later via Ace seeders + E3 scripts |
| Local vs VPS | Local remains Compose Postgres (`docs/DOCKER.md`, host `:5432`). VPS DB is the production target once E0.7 / deploy path is ready |

**Explicitly deferred:** running `CREATE DATABASE` / `CREATE ROLE` on the VPS. Documented so tomorrow’s ops can execute without re-deciding.

---

## 2. Schema — Adonis Lucid migrations

**Decision:** all schema changes ship as Lucid migrations under `apps/api/database/migrations/`. Domain tables already landed in E0; E1 profile/auth columns are done.

### Already in place (E0 / E1)

| Area | Tables / notes |
|---|---|
| Auth | `users` (+ profile, `email_verified`, password-reset version), `access_tokens` |
| Catalog | `categories`, `bottles` (`barcode`, `photo_url`, `attrs`, soft `deleted_at`), `bottle_sources` (`source` + `external_id` unique) |
| Collection | `user_bottles` (overrides, memory fields, `photo_url_override`) |
| Billing / social stubs | `subscriptions`, `friendships`, `messages`, `reports` |

### Next schema slice — E2-T01 (Sprint 2)

| Column (target) | Purpose | Freemium |
|---|---|---|
| `user_bottles.bought_at` (existing) | « Acheté chez » / lieu (free text) — **not** a purchase date | **Free** (required on write path in T03) |
| `user_bottles.fill_level` | Jauge 0–100, default `100` | Column for all plans; **write/update = premium** (E2-T03) |
| `user_bottles.fill_level_updates_count` | Ops Habitudes “mises à jour de niveau” | N/A |

**Product clarification (do not invent a second place column):** `bought_at` already stores purchase place. Do **not** add `purchase_place`. A separate purchase-date field is not in schema yet.

Ops: finished bottle = `fill_level === 0`. Numeric `note` (decimal 3,1) scale (/5 vs /10 vs /20) is **not** locked — leave flexible.

Ticket source of truth: [`tickets/E2-memory-cellar.md` § E2-T01](./tickets/E2-memory-cellar.md#e2-t01--schema-purchase-place--fill-level).

### Freemium split (server-enforced)

| Capability | Plan | Enforcement |
|---|---|---|
| Catalog / seed photo (`Bottle.photoUrl`) | Free | Always available when present |
| Memory text: place (`boughtAt`), price, note, review | Free | Not gated behind premium |
| Bottle creates (lifetime) | Free ≤ 10 (`FREE_BOTTLE_LIMIT`) | `users.bottles_created_count` increments on successful create and is never decremented on delete. Active subscription bypasses the cap (E2-T03) |
| User photo override (`UserBottle.photoUrlOverride` + upload) | **Premium** | 403 without entitlement (E2-T03 / T04) |
| Fill-level jauge set/update (`fillLevel`) | **Premium** | 403 without entitlement; free rows keep default `100` (E2-T03) |

UI may hide or tease premium controls; **authorization is always server-side**.

### Wine category attrs (E2-T12)

Only the category slug `wine` shows these fields. Other categories keep the same add and edit forms.

| Key | JSON type | Max length | UI label |
|---|---|---|---|
| `appellation` | string | 255 | Appellation |
| `grape` | string | 255 | Cépage |
| `vintage` | string | 64 | Millésime |

`vintage` is a short free-text millésime (a year such as `2015`, or a short mention). No other wine keys are part of this ticket.

Storage:

- Catalog value: `bottles.attrs.<key>` (seed, or a manual miss that creates the catalog row).
- Personal value: `user_bottles.attrs_override.<key>`. A non-empty override wins for that key. A missing or cleared key falls back to the catalog value.
- Editing a cellar entry writes `attrsOverride` only. It does not change the global `Bottle` row.
- A manual miss in `wine` may set the same keys on the new `Bottle.attrs`.

`PATCH /api/v1/collection/bottles/:id` and catalog-hit `POST` accept `attrsOverride` with only these keys (string, blank string, or null). Unknown keys are rejected. Sending `attrsOverride` for a non-wine bottle returns 422 `E_WINE_ATTRS_CATEGORY`. Omitting the field leaves other categories unchanged.

Constants live in `@atasoif/shared`: `WINE_CATEGORY_SLUG`, `WINE_ATTR_KEYS`, `WINE_ATTR_LIMITS`.

---

## 3. Catalog strategy — cache-first by EAN

**Goal (E3):** search finds real bottles so add stays &lt;30s. Local catalog is the cache; remote calls are exceptional.

### Lookup rules

| Case | External API calls | Behavior |
|---|---|---|
| Local hit by EAN / barcode | **0** | Return existing `Bottle`; never call OFF / UPCitemdb |
| Local miss + barcode known | **1–2** | OFF product API → on miss UPCitemdb nurse → upsert `Bottle` + `BottleSource` → serve from DB thereafter |
| User add **by name** (manual miss, no barcode) | **0** | Create catalog row from user input (E2 miss path); no remote lookup |
| Typeahead / name search in app | **0** | Query **local** DB only (`GET /api/v1/catalog/bottles?q=`). Do not remote-search OFF for autocomplete |

Live barcode route: `GET /api/v1/catalog/bottles/barcode/:barcode` (auth + email verified). Response includes `lookupOrigin`: `cache` \| `openfoodfacts` \| `upcitemdb`.

### Sources (priority)

| Priority | Source | Role |
|---|---|---|
| **1 — Primary seed** | **Open Food Facts dump** (filtered alcohol) | Bulk upsert into `bottles` + `bottle_sources` (`source=openfoodfacts`, `externalId` = barcode/code). Idempotent Ace `catalog:off-dump` on VPS. How-to: [`CATALOG-SEED.md`](./CATALOG-SEED.md). **Sprint 3 / E3.1–E3.2** |
| **2 — Live miss** | OFF product-by-barcode API | Only on cache miss with EAN; 1 call then upsert. Respect OFF rate limits; identify with a proper `User-Agent` |
| **3 — Pre-launch nurse** | **UPCitemdb** trial (~**100 req/day**, **no API key**) | Curated EAN list only — nurse gaps OFF misses before launch. Ace: `catalog:nurse` · how-to: [`CATALOG-NURSE.md`](./CATALOG-NURSE.md). Not a bulk scraper; not the primary seed. Paid key optional later for higher quota |
| **Won’t** | **Bright Data** / aggressive third-party scrape | Explicit **Won’t** (E3.5) unless product revisits later |

`BottleSource` unique `(source, external_id)` + optional `raw_hash` keep upserts idempotent across dump + live paths.

### Sprint mapping

| Work | When | Refs |
|---|---|---|
| Local search API (empty catalog OK) | Sprint 2 | E2-T02 · E2.3 |
| OFF dump seed + `BottleSource` upsert | Sprint 3 / pre-launch | E3.1–E3.2 · [`CATALOG-SEED.md`](./CATALOG-SEED.md) · Ace `catalog:off-dump` |
| Diff / soft-delete cron skeleton | Sprint 3 Should | E3.3 |
| UPCitemdb curated nurse | Pre-launch ops (alongside / after first OFF seed) | [`CATALOG-NURSE.md`](./CATALOG-NURSE.md) · Ace `catalog:nurse` · not Bright Data |
| v1 personal bottles (~9–15) + users | Sprint 3 Should | E2-T11 · Ace `migrate:v1-cellar` · `resources/migrate/v1/` · legacy `subscriptions.provider=legacy_v1` |

---

## 4. Photos

| Layer | Field | Who sets it | Plan |
|---|---|---|---|
| Shared catalog | `Bottle.photoUrl` | OFF dump / live upsert / seed, or a packshot attached on a catalog miss | Free for all users |
| Catalog photo review | `Bottle.photoStatus` | `pending` when a user contributes the photo on a miss. `approved` is reserved. Null for seed / OFF / no photo | Not a premium gate. No admin UI yet (moderation is a follow-up) |
| Personal override | `UserBottle.photoUrlOverride` | User upload (E2-T04) | **Premium**, server-enforced |
| Fill level | `UserBottle.fillLevel` | User gesture / edit | Schema default for all; **mutate = premium** |

Display order in UI: override (if any) → catalog `photoUrl` → striped placeholder (`docs/DESIGN.md`).

Storage MVP: local disk on VPS (R2 later). Catalog seed can mirror OFF front images to `CATALOG_IMAGE_STORAGE_PATH` via `catalog:off-dump --mirror-images` (see [`CATALOG-SEED.md`](./CATALOG-SEED.md)); otherwise `Bottle.photoUrl` may still hold a remote OFF URL until ops enables the mirror. Personal uploads and user-contributed packshots use `CELLAR_PHOTO_DIR` (default max `CELLAR_PHOTO_MAX_BYTES` = 5 MiB, jpeg/png/webp).

Serving (no public directory listing):

- Shelf override: `POST /api/v1/collection/bottles/:id/photo` (auth + verified email + owner + active subscription). `photoUrlOverride` becomes `/api/v1/collection/bottles/:id/photo`. `GET` on that path streams the file only for the owner. Clients that render an `<img>` must fetch the bytes with the bearer token (a blob URL). Files stay outside the web root.
- Catalog packshot on a miss: multipart field `catalogPhoto` on `POST /api/v1/collection/bottles` (free). Stored as `Bottle.photoUrl` = `/api/v1/media/catalog/:name` with `photoStatus = pending`. `GET` requires auth + verified email, not ownership. A remote `bottle.photoUrl` on the JSON miss path stays free and is also marked `pending`.

Moderation of `pending` photos is a follow-up. This change does not add an admin UI.

Photos from OFF are CC-BY-SA; product data is ODbL — show the FR credit string from `CATALOG-SEED.md` in app about/credits.

---

## 5. What this doc does **not** do

- Create the VPS database or app role (tomorrow / ops)
- Run OFF dump import (`catalog:off-dump`) or UPCitemdb nurse (`catalog:nurse`) — see [`CATALOG-SEED.md`](./CATALOG-SEED.md)
- Implement E2-T01 migration (done — `fill_level` / `fill_level_updates_count`; place = existing `bought_at`)
- Change freemium product rules already locked in E2 tickets / PR #14 docs

---

## Quick checklist for implementers

1. Point `DB_*` at the dedicated VPS DB once ops creates it — never share credentials with other apps.
2. Apply Lucid migrations only; keep E2-T01 before cellar CRUD that depends on `bought_at` (place) / `fill_level`.
3. Catalog reads are local-first; barcode miss = at most one external call + upsert.
4. Reject free-plan writes to `fillLevel` / `photoUrlOverride` on the API even if the client is wrong.
5. Prefer OFF dump for volume; use UPCitemdb only as a bounded pre-launch nurse from a curated EAN list.