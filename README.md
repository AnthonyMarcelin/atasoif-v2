# À ta soif ! — v2

Cave numérique multi-alcools (whisky, rhum, bière, vin…).  
Monorepo **privé** recommandé (app payante + secrets stores / OAuth).

## Stack

| Couche | Techno |
|---|---|
| API | NestJS + Prisma + PostgreSQL |
| Auth | Better Auth (email + Google + Apple) |
| Front | Angular 20 + Capacitor (iOS / Android) |
| Host | VPS OVH |
| Billing | IAP (RevenueCat) — 3,99€/mois · 39,99€/an |

## Structure

```
atasoif-v2/
├── apps/api          # NestJS
├── apps/web          # Angular (+ Capacitor plus tard)
├── packages/shared   # constantes / types partagés
└── docs/             # produit, UX, sprints
```

Monorepo OK pour les stores : Capacitor build depuis `apps/web` uniquement.

## Décisions produit

- Catalogue **global** + collection **perso**
- Freemium : **10 bouteilles** total, puis abo
- Social : amis + partage collection + messagerie (après MVP)
- IA : **hors app** (com TikTok uniquement)
- Seed start : Open Food Facts + migration v1 + catégories

## UX critique — ajout bouteille (conversion)

1. Recherche catalogue (debounce)
2. Hit → formulaire **prérempli**
3. Tous les champs + photo **modifiables** (overrides `UserBottle`)
4. Miss → création fiche catalogue + ajout collection
5. Gate freemium claire, fun, non culpabilisante

Détail : [`docs/UX-ADD-BOTTLE.md`](docs/UX-ADD-BOTTLE.md)

## Design

Direction **cave nocturne / ambre** — tokens dans `apps/web/src/styles/_tokens.scss`.

## Setup

```bash
cd atasoif-v2
cp .env.example .env   # puis DATABASE_URL
pnpm install
pnpm --filter @atasoif/shared build
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev:api           # :3000
pnpm dev:web           # :4200
```

## Repo Git

Créer un repo GitHub **privé** (pas public) quand tu es prêt :

```bash
cd atasoif-v2
git init
gh repo create atasoif-v2 --private --source=. --remote=origin
```

La v1 (`SpiritsManagement-*`) reste intacte à côté pour migration.
