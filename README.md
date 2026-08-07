# À ta soif ! — v2

Digital multi-alcohol cellar (whisky, rum, beer, wine, and more).  
**Private** repository recommended (paid app + store / OAuth secrets).

## Stack

| Layer | Technology |
|---|---|
| API | AdonisJS 7 + Lucid + PostgreSQL |
| Auth | Adonis Auth (access tokens) + Ally (Google, Facebook; Apple custom driver) |
| Front | Angular 20 + Capacitor (iOS / Android) |
| Host | OVH VPS |
| Billing | IAP (RevenueCat) — €3.99/month · €39.99/year |

## Structure

```
atasoif-v2/
├── apps/api          # AdonisJS 7 (standalone npm, Node ≥ 24)
├── apps/web          # Angular (+ Capacitor later)
├── packages/shared   # shared constants / types
├── archive/nest-api  # former Nest/Prisma API (reference only)
└── docs/             # product, UX, epics, sprints
```

Planning: [`docs/EPICS.md`](docs/EPICS.md) · [`docs/SPRINTS.md`](docs/SPRINTS.md) · [`docs/tickets/`](docs/tickets/) · [`docs/DOCKER.md`](docs/DOCKER.md) · [`docs/STACK-ADONIS.md`](docs/STACK-ADONIS.md)

pnpm workspace covers `apps/web` + `packages/*`. The API uses its own `package-lock.json` under `apps/api`.

## Product decisions

- **Global** catalog + **personal** collection
- Freemium: **10 bottles** total, then subscription
- Social: friends + collection sharing + messaging (after MVP)
- AI: **outside the app** (TikTok content only)
- Start seed: Open Food Facts + v1 migration + categories

## Critical UX — add bottle (conversion)

1. Search catalog (debounce)
2. Hit → **prefilled** form
3. All fields + photo **editable** (`UserBottle` overrides)
4. Miss → create catalog entry + add to collection
5. Clear, playful freemium gate

Details: [`docs/UX-ADD-BOTTLE.md`](docs/UX-ADD-BOTTLE.md)

## Design

Direction **dark cellar / amber** — tokens in `apps/web/src/styles/_tokens.scss`.  
Client-facing copy is **French only** (MVP); code, commits, and technical docs are **English**.  
Later: optional i18n via a `locales/` folder — not in scope until requested.

## Setup

Requires **Node ≥ 24** (Adonis 7).

```bash
cd atasoif-v2
cp .env.example .env
cp apps/api/.env.example apps/api/.env
# set APP_KEY: cd apps/api && node ace generate:key

pnpm install
pnpm --filter @atasoif/shared build
npm install --prefix apps/api
pnpm db:migrate
pnpm db:seed
pnpm dev:api           # :3000 (API on host)
pnpm dev:web           # :4200
```

### Docker (API + Postgres)

Full guide: [`docs/DOCKER.md`](docs/DOCKER.md).

```bash
# Dev — API + Postgres in containers (Postgres on host :5432)
pnpm docker:dev

# Prod-like — Postgres not published on host; set secrets in .env
pnpm docker:prod

pnpm docker:down
```

Day-to-day: Postgres in Docker (`localhost:5432`) + Adonis on the host (`pnpm dev:api`). Full `docker:dev` validates prod-like topology.

## Git

- `main` — production
- `dev` — active development
- Feature branches from `dev`
- Conventional Commits in English, no AI co-authors

## Cursor rules

Project rules live in `.cursor/rules/` (from [AnthonyMarcelin/cursor-rules](https://github.com/AnthonyMarcelin/cursor-rules), without Laravel stack rules). See `90-project-context.mdc` for identity and commands.
