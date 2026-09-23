# Tickets — E2 Memory cellar

Orchestrator backlog for Sprint 2.  
Each ticket is sized for a **sub-agent thread**. One ticket = one PR into `dev` when possible.

**Epic goal:** capture and recall bottle memory in under 30 seconds to add.

**Prerequisites (block E2 API work):** Sprint 1 Must closed enough that Bearer auth works locally; `emailVerified` hard-gate middleware exists (E1) and must be applied to cellar routes (see T03). Lucid `bottles` / `user_bottles` / categories migrated.

**Stack refs:** AdonisJS 7 + Lucid · Angular 20 · `@atasoif/shared` (`FREE_BOTTLE_LIMIT`) · Nuit design (`docs/DESIGN.md`, `docs/conception/assets/`) · add-flow law (`docs/UX-ADD-BOTTLE.md`) · DB/catalog plan (`docs/DATABASE.md`) · ops KPI source of truth (`docs/conception/ops/`).

**Product rules:**
- Client-facing copy: **French** (informal “tu”)
- Code / commits / technical comments: **English**
- Conventional Commits EN, no AI co-author
- Do **not** clone atasoif.fr v1 UI — Nuit only
- Memory fields first: **price paid**, **« Acheté chez » (place)**, **note/review**, **photo**, **fill level (jauge)**
- Freemium (aggressive conversion) — enforce **server-side**:
  - Max **10 lifetime creates** without entitlement (`FREE_BOTTLE_LIMIT`). Deleting a `UserBottle` does **not** free a slot (`users.bottles_created_count`, never decremented). An active subscription bypasses the cap.
  - **FREE:** catalog / seed photo only (`Bottle.photoUrl`)
  - **PREMIUM required:** user photo override (`UserBottle.photoUrlOverride` + upload) **and** bottle fill-level jauge (set / update `fillLevel`)
  - **Not gated** in E2 (unless a later ticket says otherwise): « Acheté chez », price, notes/review, boughtAt, catalog search/add
- Photos: catalog `Bottle.photoUrl` (free) + personal `UserBottle.photoUrlOverride` (premium)
- Ops in E2: **thin API only** — feed KPIs already defined in ops mockups; **no** admin UI

**User decisions (Must / S2):**
1. Purchase place « Acheté chez » / lieu — required in schema + UI (free)
2. Bottle level jauge (swipe) — in E2 (not deferred); **premium** to set/update; free keeps schema default
3. Photos — FREE = catalog/DB only; PREMIUM = user override + upload (T04)
4. Ops — align API with Claude Design KPIs in `docs/conception/ops/` (do not invent a parallel KPI set)

---

## Ticket index

| ID | Title | Priority | Sprint | Depends on | Suggested owner |
|---|---|---|---|---|---|
| [E2-T01](#e2-t01--schema-purchase-place--fill-level) | Schema: purchase place + fill level | Must | S2 | S1 auth | API |
| [E2-T02](#e2-t02--catalog-search-api) | Catalog search API | Must | S2 | T01 | API |
| [E2-T03](#e2-t03--collection-crud-api--freemium--email-gate) | Collection CRUD API + freemium + email gate | Must | S2 | T01, S1 email gate | API |
| [E2-T04](#e2-t04--photo-upload--storage) | Photo upload + storage | Must | S2 | T03 | API |
| [E2-T05](#e2-t05--cave-list--filter-ui--freemium-counter) | Cave list / filter UI + freemium counter | Must | S2 | T03, T05-web-auth | Web |
| [E2-T06](#e2-t06--bottle-detail-ui--jauge) | Bottle detail UI + jauge | Must | S2 | T03, T05 | Web |
| [E2-T07](#e2-t07--add-flow-ui-search--hit--miss) | Add flow UI (search → hit / miss) | Must | S2 | T02, T03, T04, T05 | Web |
| [E2-T08](#e2-t08--edit--delete-ui--jauge-swipe) | Edit / delete UI + jauge swipe | Must | S2 | T06, T07 | Web |
| [E2-T09](#e2-t09--ops-kpi-thin-api) | Ops KPI thin API (mockup-aligned) | Must | S2 | T03 | API |
| [E2-T10](#e2-t10--paywall-shell-ui) | Paywall shell UI | Should | S2 | T05, T07 | Web |
| [E2-T11](#e2-t11--migrate-v1-bottles) | Migrate ~9–15 bottles from v1 | Should | S3 | T03 | API |
| [E2-T12](#e2-t12--wine-attrs-in-collection) | Wine attrs in collection | Should | later | T03 | Full |

**Recommended order:** T01 → T02 ∥ T03 → T04 → T05 → T06 ∥ T07 → T08 → T09 · T10 optional parallel after T07 · T11–T12 later

---

## E2-T01 — Schema: purchase place + fill level

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/api` (+ `@atasoif/shared` types if needed) |
| **Depends on** | Lucid domain migrations present |
| **Blocks** | T02–T08, T09 |

### Goal
Make memory schema match Nuit + UX-ADD-BOTTLE: « Acheté chez » on existing `bought_at`, fill-level column for the jauge (premium write path in T03), without inventing fields ops/mockups do not need.

### Product clarification (lieu)
Existing `user_bottles.bought_at` (string) **is** purchase place / « Acheté chez » — do **not** add a parallel `purchase_place` column. A separate purchase-date field is deferred. Numeric `note` (decimal 3,1) scale is not locked.

### Acceptance criteria
- [x] Document **`bought_at`**: « Acheté chez » / lieu (free text); required on write path in T03 — **no** new place column
- [x] Lucid migration adds **`fill_level`** (`integer` 0–100, not null, default `100`) for jauge storage
- [x] Thin counter **`fill_level_updates_count`** (default `0`) so ops Habitudes « mises à jour de niveau » can be fed later without a full event store in E2
- [x] Models + schema types updated; Vine rules ready for T03 (`boughtAt` required as place; `fillLevel` 0–100 when accepted)
- [x] Document freemium split for T03/T04: free rows keep `fill_level` default; **mutating** `fill_level` / setting `photoUrlOverride` is premium (server-side)
- [x] Finished bottle for ops = `fill_level === 0` (documented in `docs/DATABASE.md` + model comments)
- [x] API tests or migration test prove columns exist

### Out of scope
- Angular UI
- Forced enum for purchase place (Nuit is free text; ops « lieux » chart aggregates free text — do not invent a closed category list)
- Level history timeline UI
- Entitlement enforcement (T03 / T04)
- New `purchase_place` column (rejected — use `bought_at`)

### Tech notes
- Prefer smallest migration; empty `user_bottles` needs no place backfill
- Do not mutate global `Bottle` for personal memory fields
- Schema holds `fill_level` for all plans; **premium gate is on write/update**, not on column presence

### Suggested commit
`feat: add fill level to user bottles`

---

## E2-T02 — Catalog search API

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/api` |
| **Depends on** | T01 (stable bottle model) |
| **Blocks** | T07 |

### Goal
Search the shared local catalog so the add flow can prefill fast (local DB only in S2 — remote lookup is E3 / Sprint 3).

### Acceptance criteria
- [ ] Authenticated + `emailVerified` route: search bottles by name / brand (barcode stub OK)
- [ ] Debounce-friendly: short `q` query, sensible limit/pagination
- [ ] Response includes fields needed to prefill: id, name, brand, origin, abv, volumeMl, photoUrl, category, attrs
- [ ] Empty catalog returns empty list (not 500)
- [ ] API tests: hit + empty query behaviour

### Out of scope
- Open Food Facts / remote provider (E3)
- Angular search UI (T07)
- Catalog moderation admin (ops Catalogue page UI)

### Suggested commit
`feat: add local catalog search endpoint`

---

## E2-T03 — Collection CRUD API + freemium + email gate

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/api` |
| **Depends on** | T01; E1 `emailVerified` middleware |
| **Blocks** | T04–T08, T09 |

### Goal
Personal cellar CRUD with memory fields, freemium enforcement (bottle cap **and** premium-only jauge / photo override), and email-verification hard-gate on all cellar routes (E1 Bugbot forward-looking item).

### Acceptance criteria
- [ ] Routes under `/api/v1/...` for list / show / create / update / delete `UserBottle` (owner-only)
- [ ] List supports filter by category (and stable sort)
- [ ] Create supports catalog **hit** (existing `bottleId`) and **miss** (create `Bottle` with user source + `UserBottle` in one flow or documented two-step)
- [ ] Required on create/update: **`boughtAt`** (« Acheté chez » / place); memory fields free for all plans: `pricePaid`, `note`, `review`
- [ ] Overrides never mutate global `Bottle` by default
- [ ] Freemium bottle cap: if no active entitlement and lifetime creates ≥ `FREE_BOTTLE_LIMIT` (10), create returns **403** with clear JSON (reuse shared constant). The counter increments on successful create and is not decremented on delete. Active subscription bypasses the cap.
- [ ] **Premium gate — jauge (server-side):** without entitlement, create/update that sets or changes **`fillLevel`** (anything other than leaving the server default `100` untouched) returns **403** with a stable error code (e.g. `E_PREMIUM_REQUIRED` / feature `fillLevel`); free creates persist default `fill_level = 100` and must not accept client-driven level changes
- [ ] **Premium gate — user photo (server-side):** without entitlement, create/update that sets **`photoUrlOverride`** (non-null) returns **403** with the same premium error shape (feature `photoOverride`); free users keep catalog `Bottle.photoUrl` only
- [ ] Response includes freemium payload e.g. `{ count, limit, remaining, entitlement }` (or equivalent) so UI can hide/lock jauge + photo replace
- [ ] All cellar collection routes use **auth + `emailVerified`** (unverified → 403 `E_EMAIL_UNVERIFIED`)
- [ ] Users can only mutate their own rows
- [ ] API tests: happy path free (place/notes OK, catalog photo), 11th bottle blocked, free user blocked on `fillLevel` write, free user blocked on `photoUrlOverride`, premium (or stubbed entitlement) can set both, foreign id 403/404, unverified 403

### Out of scope
- Photo binary upload (T04) — but reject override URL writes here consistently with T04
- Paywall UI (T10)
- Subscription IAP verification (E4) — entitlement check may stub “no subscription” until S4 (gates must still fire)

### Tech notes
- Import `FREE_BOTTLE_LIMIT` from `@atasoif/shared` when practical
- Context7 for Adonis auth middleware composition
- Do **not** gate « Acheté chez » (`boughtAt`), price, note, or review behind premium
- Place field is **`boughtAt`** → `bought_at` (no `purchasePlace` / `purchase_place` column)
### Suggested commit
`feat: add cellar collection API with freemium gate`

---

## E2-T04 — Photo upload + storage

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/api` |
| **Depends on** | T03 |
| **Blocks** | T07 (replace photo path) |

### Goal
Upload a **premium** personal bottle photo; store URL on `UserBottle.photoUrlOverride`. Catalog / seed photo remains `Bottle.photoUrl` (free).

### Acceptance criteria
- [ ] Authenticated + email-verified upload endpoint (multipart) for cellar photos
- [ ] **Premium required (server-side):** without entitlement, upload returns **403** (`E_PREMIUM_REQUIRED` / feature `photoOverride`) — do not persist file
- [ ] Validation: mime allowlist (jpeg/png/webp), max size documented, no path traversal
- [ ] Storage: **local disk** under configured dir (VPS filesystem OK for MVP) — env documented in `.env.example`
- [ ] Successful upload (entitled) returns URL/path usable as `photoUrlOverride`
- [ ] Serving strategy documented (owner-only authenticated GET, files outside the web root) without exposing other users’ files
- [ ] A catalog packshot contributed while creating a missing `Bottle` stays available on the free plan (`Bottle.photoUrl`). User-contributed catalog photos are stored with `photoStatus = pending` (moderation UI is a follow-up, not this ticket)
- [ ] API tests: fixture image happy path with entitlement stub; free plan rejected; storage fake OK

### Out of scope
- Cloudflare R2 (later)
- Capacitor camera (E5)
- Ops UI
- Free-plan catalog photo seeding (E3 / seed scripts)

### Suggested commit
`feat: add cellar photo upload storage`

---

## E2-T05 — Cave list / filter UI + freemium counter

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/web` |
| **Depends on** | T03 (API contract); Bearer + route guards from E1 |

### Goal
« Ma cave » list with category filter and always-visible freemium `x/10` counter (Nuit).

### Acceptance criteria
- [ ] Route `/cave` (or equivalent) lists current user’s bottles
- [ ] Filter by category works
- [ ] Counter `x/10` always visible in cellar chrome
- [ ] Photo: catalog `photoUrl` for free; override only when present (premium); striped placeholder when missing (`docs/DESIGN.md`)
- [ ] FR copy, Nuit tokens, accessible list semantics
- [ ] Unverified users redirected / blocked consistently with E1 hard-gate

### Out of scope
- Add flow (T07)
- Detail page (T06)
- Friends cave
- Interactive jauge on list rows (detail / T08)

### Suggested commit
`feat: add cellar list and freemium counter`

---

## E2-T06 — Bottle detail UI + jauge

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/web` |
| **Depends on** | T03, T05 |

### Goal
Detail screen prioritises memory: price, « Acheté chez », note/review, photo, and fill-level jauge (premium interactive / free locked teaser).

### Acceptance criteria
- [ ] Detail route shows memory fields prominently (not buried) — place / price / note free
- [ ] **Premium:** jauge renders live fill level (Nuit: ivory stroke, amber fill)
- [ ] **Free:** jauge is locked / teaser (no level edit); CTA toward paywall — do not invent a parallel free “fake level” UX
- [ ] Photo: override (premium) → else catalog → else striped placeholder
- [ ] FR copy; matches Nuit hierarchy (`docs/conception/assets/` screen 04)
- [ ] Empty/error states short and actionable

### Out of scope
- Swipe-to-edit level (T08)
- Edit form full (T08)

### Suggested commit
`feat: add bottle detail with fill level gauge`

---

## E2-T07 — Add flow UI (search → hit / miss)

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/web` |
| **Depends on** | T02, T03, T04, T05 |

### Goal
Add a bottle in &lt;30s per `docs/UX-ADD-BOTTLE.md`: search → editable prefill → confirm; miss creates catalog + collection entry.

### Acceptance criteria
- [ ] Search-first step with debounce (~250ms) against catalog API
- [ ] Hit prefills catalog fields + catalog photo; free fields editable (name/brand/attrs as already allowed)
- [ ] Memory fields first-class for free: **price**, **« Acheté chez » (required)**, note/review
- [ ] **Photo replace** and **niveau (jauge)** controls: premium only — free keeps catalog photo; attempting replace / jauge opens paywall (T10) and must not call blocked APIs as if free
- [ ] Miss path: “Pas trouvé ? Ajoute-la” → create bottle + user bottle
- [ ] On freemium block (11th **or** premium feature deny), navigate to paywall shell route (T10 may stub)
- [ ] FR copy; no v1 clone; no 15-field wall before search

### Out of scope
- Remote catalog lookup (E3)
- IAP purchase

### Suggested commit
`feat: add bottle search and confirm flow`

---

## E2-T08 — Edit / delete UI + jauge swipe

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/web` (+ thin API tweak if patch-level-only helper needed) |
| **Depends on** | T06, T07 |

### Goal
Edit and delete collection entries; update fill level via swipe (or equivalent direct gesture) on the jauge when premium.

### Acceptance criteria
- [ ] Edit persists free overrides + required `boughtAt` place (price, note, review)
- [ ] **Premium:** edit may persist `fillLevel` and photo override; jauge swipe / drag updates level and saves (updates `fill_level_updates_count` via API)
- [ ] **Free:** jauge swipe / photo replace locked → paywall; must not send `fillLevel` / `photoUrlOverride` writes that the API will 403
- [ ] Delete with explicit confirmation (destructive) — available on free
- [ ] Respects `prefers-reduced-motion` for non-essential animation
- [ ] Owner-only; errors in short FR messages (incl. premium required)

### Out of scope
- Social visibility deep settings (E6)
- Full tasting history log UI

### Suggested commit
`feat: add cellar edit delete and level swipe`

---

## E2-T09 — Ops KPI thin API (mockup-aligned)

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/api` |
| **Depends on** | T03 (collection data exists) |
| **Blocks** | none in S2 (feeds future admin UI) |

### Goal
Expose **thin read APIs** that can feed the KPIs already defined in Claude Design ops mockups (`docs/conception/ops/README.md` + screens). **Do not invent an alternate KPI set.** **Do not build ops UI in E2.**

### Source of truth (do not redesign)

| Ops page | KPI / data the API must eventually feed | E2 expectation |
|---|---|---|
| Vue d’ensemble | Bouteilles ajoutées; bouteilles / user; sessions / semaine; revenue widgets | Cellar counts live; sessions/revenue **stub or omit** until analytics/billing exist |
| Revenus | MRR, ARR, ARPU, LTV, churn, cancel reasons | **Stub/omit** (E4) — document gap |
| Conversion | Funnel: compte créé → 1ʳᵉ bouteille → 3 bouteilles → cave 10/10 → paywall vu → abonnement; délai; triggers; plan mix | Funnel stages from user + `user_bottles` counts **live**; paywall/pay/plan **stub** until E4 |
| Acquisition | Inscrits, nouveaux/jour, activation (= 1ʳᵉ bouteille ≤30j), CAC, viralité, sources, auth method, plateforme | Activation + auth-method breakdown **live** where data exists; CAC/sources/platform **stub** |
| Rétention | Cohortes; rétention par taille de cave (seuil produit **4** bouteilles) | Cellar-size buckets **live**; full cohort engine may be simplified |
| Utilisateurs | Search / table / account actions | **Out** — no admin user UI; optional minimal list endpoint only if needed for KPI joins |
| Habitudes | Bouteilles en cave; /user mean+median; prix moyen; note moyenne; % avec mot écrit; % terminées; top 10; répartition prix; **lieux d’achat**; durée de vie; **mises à jour de niveau**; rachat | **Primary E2 feed** — implement aggregates from `user_bottles` |
| Catalogue | Moderation queue, merges | **Out** of E2 (E3/admin later) |
| Social | Friends impact, reports | **Out** (E6) |
| Technique | Endpoints, errors, versions | Reuse `/health`; no full ops technique UI |

Product readings already called out in ops README (retain as comments in API docs, not new metrics): retention cliff &lt;4 bottles; annual vs monthly churn (billing later); social lift (E6).

### Acceptance criteria
- [x] One or few **read-only** admin/internal endpoints (e.g. `/api/v1/ops/kpis/...`) returning JSON shaped for the **Habitudes** + **Conversion funnel cellar stages** + **Vue d’ensemble bottle counters** above
- [x] Purchase-place aggregation uses real `bought_at` values (top-N), not a fabricated enum
- [x] “Terminées” uses `fill_level === 0`; level updates use `fill_level_updates_count` (or equivalent)
- [x] Response documents `live` vs `stub` fields explicitly so future UI does not treat stubs as real
- [x] Protected (env admin token / role TBD) — not public; no secrets in payloads
- [x] **No** Angular/admin HTML implementation in this ticket
- [x] Short note in `docs/conception/ops/README.md` pointing to the API contract (link only)

### Out of scope
- Full ops UI (all 10 screens)
- CSV export, moderation actions, offer premium, suspend user
- Inventing KPIs not present in mockups
- Bright Data / marketing CAC pipelines

### Suggested commit
`feat: add thin ops KPI endpoints from cellar data`

---

## E2-T10 — Paywall shell UI

| | |
|---|---|
| **Type** | feat |
| **Priority** | Should |
| **Area** | `apps/web` |
| **Depends on** | T05, T07 |

### Goal
Freemium / premium-upsell screen (monthly €3.99 / yearly €39.99) — shell OK without real IAP in S2.

### Acceptance criteria
- [ ] Route for paywall when 11th add is blocked **or** when jauge / user-photo premium gate fires
- [ ] Copy variants (or one flexible screen) cover: cave pleine **and** premium features (photo perso, jauge)
- [ ] Shows both plan prices from `@atasoif/shared` `PLANS`
- [ ] FR copy (“Cave pleine — passe premium…” / short feature upsell — no eng jargon)
- [ ] CTA may be disabled / “bientôt” if billing not ready — documented

### Out of scope
- RevenueCat / store purchase (Sprint 4)

### Suggested commit
`feat: add freemium paywall shell screen`

---

## E2-T11 — Migrate v1 bottles

| | |
|---|---|
| **Type** | chore |
| **Priority** | Should |
| **Sprint** | **S3** (with catalog lookup) |
| **Area** | `apps/api` |
| **Depends on** | T03 |

### Goal
Import owner’s ~9–15 bottles from legacy Railway Postgres / dump into Lucid models including place + level defaults.

### Acceptance criteria
- [x] Documented one-shot script or ace command
- [x] Idempotent where practical
- [x] Maps memory fields; sets `bought_at` / `fill_level` sensibly when missing

### Tech notes (locked product decisions)
- Ace: `node ace migrate:v1-cellar` (`apps/api/resources/migrate/v1/*.json` + live `DATABASE_PUBLIC_URL` for `$argon2id$` hashes)
- All v1 users migrated (dedupe email keep lowest id); legacy `subscriptions` (`provider=legacy_v1`) for premium exception
- Notes kept as-is; photos → `photo_url_override`; `fill_level` default 100
- See store export / `resources/migrate/v1/README.md`

### Out of scope
- Full user base migration tooling

### Suggested commit
`chore: migrate legacy cellar bottles from v1`

---

## E2-T12 — Wine attrs in collection

| | |
|---|---|
| **Type** | feat |
| **Priority** | Should |
| **Sprint** | later / polish |
| **Area** | `apps/api` + `apps/web` |
| **Depends on** | T03 |

### Goal
Wine-specific fields via `attrs` / `attrsOverride` (appellation, grape, vintage…).

### Acceptance criteria
- [x] Documented attr keys (`appellation`, `grape`, `vintage` only). See `docs/DATABASE.md` § Wine category attrs.
- [x] Add/edit UI shows wine fields when category is wine
- [x] Does not break other categories

### Out of scope
- Full wine social network features

### Suggested commit
`feat: add wine attribute fields on cellar entries`

---

## Orchestrator notes

- Follow `.cursor/rules` (EN code/docs, FR UI). Use Context7 for Adonis / Lucid / Vine.
- Prefer smallest PR per ticket; API before dependent UI.
- Apply `emailVerified` on every new cellar route (E1 Bugbot carry-over).
- Freemium: bottle cap **plus** server-side premium gates for **jauge** + **user photo**; never rely on UI hide alone.
- Ops KPI names and funnel steps must stay aligned with `docs/conception/ops/` — if a mockup label conflicts with code naming, **rename code**, do not invent a second vocabulary.
- Archive Nest tree is reference-only.
