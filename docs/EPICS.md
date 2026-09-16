# Epics

North star JTBD: *“I buy a bottle — months later I still know where, how much, and whether it was good.”*

Everything below is ranked for that outcome. Social and growth come after memory + monetization work.

---

## E0 — Platform foundation

**Goal:** Runnable monorepo, DB, rules, deployable API shell.

| ID | Story | Priority |
|---|---|---|
| E0.1 | Monorepo (API + web + shared) | Done |
| E0.2 | Domain schema (catalog, collection, auth, billing, social stubs) — Lucid | Done |
| E0.3 | Cursor rules + product docs | Done |
| E0.4 | Local Postgres + Lucid migrate + seed categories | Done |
| E0.5 | AdonisJS 7 API + `/health` (DB ping) | Done |
| E0.6 | Docker Compose Adonis API + Postgres (dev/prod, Node 24) | Done |
| E0.7 | OVH VPS + TLS reverse proxy | Should (before stores) |

**Out of scope:** fancy CI, staging env.

---

## E1 — Identity & access

**Goal:** Users can create an account and stay signed in on web (then mobile).

**Tickets:** [`docs/tickets/E1-identity.md`](./tickets/E1-identity.md)

| ID | Story | Priority | Ticket |
|---|---|---|---|
| E1.1 | Adonis Auth email + password + tokens | Must | T01–T02 |
| E1.2 | Email verification + password reset | Must | T03 |
| E1.3 | Ally Google OAuth | Should | T07 |
| E1.4 | Ally Facebook OAuth (login only) | Should | T08 |
| E1.5 | Apple Sign In (custom Ally driver) | Must before iOS store if social login offered | T09 (S5) |
| E1.6 | Profile: pseudo, public/private flag | Should | T06 |
| — | Auth UI + Bearer wire-up | Must | T04–T05 |

---

## E2 — Memory cellar (core product)

**Goal:** Capture and recall bottle memory in under 30 seconds to add.

**Tickets:** [`docs/tickets/E2-memory-cellar.md`](./tickets/E2-memory-cellar.md)

| ID | Story | Priority | Ticket |
|---|---|---|---|
| E2.1 | List / filter personal collection by category | Must | T05 |
| E2.2 | Bottle detail: price, « Acheté chez » (place), boughtAt date, note, review, photo, jauge | Must | T01, T06 |
| E2.3 | Search shared catalog (local) | Must | T02, T07 |
| E2.4 | Add from catalog hit → editable prefill + overrides + photo | Must | T03, T04, T07 |
| E2.5 | Add when miss → create catalog row + collection entry | Must | T03, T07 |
| E2.6 | Edit / delete collection entry + jauge swipe | Must | T08 |
| E2.7 | Freemium counter `x/10` visible in cellar | Must | T05 |
| E2.8 | Server-side enforce free limit (+ `emailVerified` hard-gate on cellar routes) | Must | T03 |
| E2.9 | Required purchase place « Acheté chez » in schema + UI | Must | T01, T07–T08 |
| E2.10 | Fill-level jauge (0–100) required; swipe to update | Must | T01, T06, T08 |
| E2.11 | Photo: catalog `photoUrl` + user `photoUrlOverride` + upload/storage | Must | T04 |
| E2.12 | Ops thin API aligned to existing ops mockup KPIs (no ops UI) | Must | T09 |
| E2.13 | Migrate ~9–15 bottles from v1 | Should | T11 (S3) |
| E2.14 | Wine category fields in `attrs` (appellation, grape, vintage…) | Should | T12 |
| — | Paywall shell (E4.1 stub) | Should | T10 |

**UX law:** do not copy atasoif.fr v1. Optimize for memory fields first.  
**Ops law:** KPI names/funnels from `docs/conception/ops/` are source of truth — do not invent a parallel set.

---

## E3 — Catalog enrichment

**Goal:** Search finds real bottles so add stays fast.

| ID | Story | Priority |
|---|---|---|
| E3.1 | One-shot Open Food Facts alcohol import | Must |
| E3.2 | `BottleSource` tracking + upsert by external id / barcode | Must |
| E3.3 | Diff cron (add / update / soft-delete) | Should |
| E3.4 | Admin or moderated user contributions to catalog | Could |
| E3.5 | Bright Data / third-party scrape | Won’t (unless explicit later) |

---

## E4 — Monetization

**Goal:** Convert memory habit into recurring revenue.

| ID | Story | Priority |
|---|---|---|
| E4.1 | Paywall UI (monthly €3.99 / yearly €39.99) | Must |
| E4.2 | RevenueCat (or equivalent) + Apple/Google IAP | Must |
| E4.3 | Persist `Subscription` + entitlement check on API | Must |
| E4.4 | Restore purchases / account linking | Should |
| E4.5 | Web billing (Stripe) | Could (stores first) |

---

## E5 — Mobile delivery

**Goal:** Same Angular app on iOS + Android via Capacitor.

| ID | Story | Priority |
|---|---|---|
| E5.1 | Capacitor bootstrap from `apps/web` | Must |
| E5.2 | Native builds + icons + splash | Must |
| E5.3 | Secure storage / deep links for auth | Should |
| E5.4 | Photo picker / camera for bottle shots | Should |
| E5.5 | Push notifications | Won’t (MVP) |

---

## E6 — Social (post-MVP)

**Goal:** Share the cellar with friends — not the core JTBD.

| ID | Story | Priority |
|---|---|---|
| E6.1 | Find by pseudo / invite link | Should |
| E6.2 | Friend request accept / block | Should |
| E6.3 | Share collection yes/no + visibility | Should |
| E6.4 | Messaging between friends | Could |
| E6.5 | Report content / user | Should (if social ships) |

---

## E7 — Stores, legal, growth ops

**Goal:** Ship legally and support acquisition outside the app.

| ID | Story | Priority |
|---|---|---|
| E7.1 | Privacy policy + ToS (RGPD) | Must |
| E7.2 | Age rating 17+ / alcohol guidelines | Must |
| E7.3 | App Store + Play listing, screenshots | Must |
| E7.4 | Account deletion / data export hooks | Must (RGPD) |
| E7.5 | TikTok / social content pipeline (AI **outside** app) | Could (parallel, not blocking code) |

---

## Epic dependency map

```text
E0 Platform ──► E1 Auth ──► E2 Memory cellar ──► E4 Monetization
                     │              │
                     │              └──► E3 Catalog (can overlap late E2)
                     │
                     └──► E5 Mobile ──► E4 IAP (native) ──► E7 Stores/legal

E6 Social ──────── after E2 (+ preferably E4)

E7.5 Growth ops ── parallel anytime (no in-app AI)
```

## MVP definition (ship-worthy)

Shippable MVP = **E0 + E1 + E2 + E4 + E5 + E7.1–E7.3**  
Nice-to-have in MVP window: E2.13, E2.14, E3.1–E3.2  
Explicitly later: **E6**, E3.5, E5.5, locales/
