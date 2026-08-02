# Sprints

Dev solo + Cursor. Un sprint = un objectif shippable.

## Sprint 0 — Fondations

- [x] Monorepo pnpm (`apps/api`, `apps/web`, `packages/shared`)
- [x] Schéma Prisma (catalogue, collection, social, billing, auth)
- [x] Tokens design cave nocturne
- [x] Doc UX ajout bouteille
- [x] `pnpm install` + Prisma generate + tests API
- [ ] Postgres local (`docker compose up -d`) + migrate + seed
- [ ] Repo GitHub **privé**
- [ ] Brancher `PrismaModule` dans `AppModule`

## Sprint 1 — Auth + health

- Better Auth (email + Google ; Apple plus tard stores)
- Endpoints health / me
- Guard Nest + session cookie

## Sprint 2 — Cave MVP

- CRUD catégories / search bottles
- Add bottle flow (search → prefill → overrides + photo)
- Compteur freemium 10
- Migration 15 bouteilles v1

## Sprint 3 — Seed catalogue

- Import Open Food Facts (filtre alcool)
- `BottleSource` + script one-shot
- Cron diff (structure, pas Bright Data)

## Sprint 4 — Mobile + IAP

- Capacitor iOS/Android
- RevenueCat / StoreKit + Play Billing
- Paywall UI

## Sprint 5 — Social

- Amis (pseudo / lien)
- Partage collection
- Messagerie
- Signalement / blocage

## Sprint 6 — Stores + legal

- Apple Sign In
- Age rating 17+
- RGPD / CGU
- Screenshots + listing
