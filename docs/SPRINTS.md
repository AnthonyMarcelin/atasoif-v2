# Sprint planning

Solo + Cursor. One sprint ≈ focused outcome. Prefer finishing an epic slice over starting three.

**North star:** memory cellar (where / price / was it good) — not social, not v1 clone.

Epics: [`EPICS.md`](./EPICS.md)

---

## Cadence

| | |
|---|---|
| Length | Flexible (outcome-based), aim 3–7 days of focused work |
| Branch | Feature from `dev` → PR into `dev` → release PR `dev` → `main` |
| DoD | See `90-project-context.mdc` + sprint exit criteria below |
| Language | Code/docs/commits EN · UI FR |

---

## Sprint 0 — Foundations

**Epics:** E0  
**Status:** ✅ Closed

- [x] pnpm monorepo (`apps/api`, `apps/web`, `packages/shared`)
- [x] Prisma schema (catalog, collection, social, billing, auth)
- [x] Dark cellar design tokens
- [x] Add-bottle UX doc
- [x] `pnpm install` + Prisma generate + API tests
- [x] Cursor rules (global + project context)
- [x] Local Postgres (`docker compose up -d`) + migrate + seed
- [x] Wire `PrismaModule` into `AppModule`
- [x] `GET /health` reports `database: up`

### Exit criteria

- API boots against local Postgres
- Categories seeded (9)
- Prisma client used from Nest
- `/health` → `{ status: "ok", database: "up" }`

---

## Sprint 1 — Auth

**Epics:** E1  
**Tickets:** [`docs/tickets/E1-identity.md`](./tickets/E1-identity.md) — T01→T08 (T09 deferred to S5)  
**Depends on:** Sprint 0 closed

### Scope

- T01 Better Auth bootstrap
- T02 Email/password API
- T03 Guard + `/me`
- T04 Verification + reset
- T05 Auth UI shell
- T06 Wire web + guards
- T07 Pseudo + visibility (should)
- T08 Google OAuth (should)

### Explicitly out

- Apple Sign In → **E1-T09 / Sprint 5**
- Social friends

### Exit criteria

- New user can register, verify (or dev bypass documented), sign in, hit a protected route
- Unauthenticated requests rejected server-side
- All Must tickets T01–T06 done (T04 may ship with documented mail bypass)
---

## Sprint 2 — Memory cellar MVP

**Epics:** E2 (core), E4.1 stub paywall UI optional  
**Depends on:** Sprint 1

### Scope

- Collection list + detail (memory fields prominent: `pricePaid`, `boughtAt`, note, review, photo)
- Catalog search API + UI
- Add flow: search → prefill → edit all + photo → save
- Miss path: create bottle + user bottle
- Edit / delete
- Freemium: UI counter + **server** block at 11
- Paywall screen shell (can be non-billing “coming soon” if Sprint 4 not ready)

### Explicitly out

- OFF import (Sprint 3)
- IAP purchase (Sprint 4)
- Friends

### Exit criteria

- Happy path: search → add → see bottle in collection with where/price/note in &lt;30s UX intent
- 11th bottle blocked without entitlement
- No dependency on atasoif.fr v1 layouts

---

## Sprint 3 — Catalog seed

**Epics:** E3.1–E3.3, E2.9 migrate v1  
**Depends on:** Sprint 2 (search exists); can start import scripts earlier

### Scope

- OFF dump filter → upsert bottles + `BottleSource`
- One-shot script + documented runbook
- Cron/diff skeleton (schedule + soft-delete)
- Migrate personal ~15 bottles from v1 DB

### Exit criteria

- Search returns a useful volume of real products (beer/wine/spirits)
- Re-run import is idempotent
- Owner collection migrated or import path documented

---

## Sprint 4 — Billing + Capacitor

**Epics:** E4 + E5 (bootstrap)  
**Depends on:** Sprint 2 freemium gate

### Scope

- Capacitor iOS/Android from `apps/web`
- RevenueCat (or chosen IAP layer)
- Entitlement sync → `Subscription`
- Real paywall (monthly / yearly)
- Restore purchases

### Exit criteria

- Sandbox purchase unlocks &gt;10 bottles on device build
- API trusts verified entitlement (not client flag alone)

---

## Sprint 5 — Harden mobile + Apple auth

**Epics:** E1.5, E5.2–E5.4, start E7  
**Depends on:** Sprint 4

### Scope

- Apple Sign In
- Icons, splash, store assets draft
- Camera / photo picker for bottles
- Privacy policy + ToS drafts

### Exit criteria

- TestFlight / internal testing track installable
- Auth works with email + Google + Apple on device

---

## Sprint 6 — Store release

**Epics:** E7.1–E7.4  
**Depends on:** Sprint 5

### Scope

- Store listings FR, age 17+, alcohol compliance review
- Account deletion / export
- Production OVH + monitoring basics
- Submit iOS + Android

### Exit criteria

- Apps submitted (or live)
- Legal pages linked in-app and on atasoif.fr

---

## Sprint 7+ — Social & growth (backlog)

**Epics:** E6, E7.5, E3.4

- Friends / share collection / messaging
- Report & block
- TikTok content pipeline (outside repo or separate tooling)
- Optional `locales/` — only on explicit request

Do not pull Sprint 7 into MVP unless memory + paywall are live.

---

## Priority board (now → later)

```text
NOW     S0 close → S1 Auth → S2 Memory cellar
NEXT    S3 Catalog seed ∥ polish S2
THEN    S4 IAP + Capacitor → S5 Apple → S6 Stores
LATER   S7 Social / growth / locales
```

## Risks to watch each sprint

| Risk | Mitigation |
|---|---|
| Scope creep (social, scrapers, i18n) | Epics E6 / E3.5 / locales explicitly later |
| Add flow too heavy | UX-ADD-BOTTLE.md; memory fields first |
| IAP complexity | Paywall shell in S2; real IAP only S4 |
| Catalog empty → bad conversion | S3 right after S2, not after stores |
| Solo bandwidth | One sprint goal; no parallel epics unless blocked |

## Suggested Cursor workflow

1. Open sprint section + linked epic IDs
2. One feature branch per story cluster
3. Implement → narrow tests → update sprint checkboxes in this file
4. PR to `dev`
