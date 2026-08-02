# Sprints

Solo + Cursor. One sprint = one shippable outcome.

## Sprint 0 — Foundations

- [x] pnpm monorepo (`apps/api`, `apps/web`, `packages/shared`)
- [x] Prisma schema (catalog, collection, social, billing, auth)
- [x] Dark cellar design tokens
- [x] Add-bottle UX doc
- [x] `pnpm install` + Prisma generate + API tests
- [x] Cursor rules (global + project context)
- [ ] Local Postgres (`docker compose up -d`) + migrate + seed
- [ ] Wire `PrismaModule` into `AppModule`

## Sprint 1 — Auth + health

- Better Auth (email + Google; Apple later for stores)
- Health / me endpoints
- Nest guard + session cookie

## Sprint 2 — Cellar MVP

- Category CRUD / bottle search
- Add-bottle flow (search → prefill → overrides + photo)
- Freemium counter (10)
- Migrate ~15 bottles from v1

## Sprint 3 — Catalog seed

- Open Food Facts import (alcohol filter)
- `BottleSource` + one-shot script
- Diff cron structure (not Bright Data)

## Sprint 4 — Mobile + IAP

- Capacitor iOS/Android
- RevenueCat / StoreKit + Play Billing
- Paywall UI

## Sprint 5 — Social

- Friends (pseudo / link)
- Collection sharing
- Messaging
- Report / block

## Sprint 6 — Stores + legal

- Apple Sign In
- Age rating 17+
- GDPR / ToS
- Screenshots + store listing
