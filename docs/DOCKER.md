# Docker — API + Postgres (+ site séparément)

Containerize **API + database** only in Compose. Angular/Capacitor stay on the host for native store builds.

## Production Dokploy — api / site / ops

Prod uniforme : CI → GHCR `:<full-sha>` → API Dokploy → smoke → rollback **par service**.  
**Runbook + checklist Anthony :** [`docs/DEPLOY-PROD.md`](./DEPLOY-PROD.md) · détail API env : [`docs/DOKPLOY-API.md`](./DOKPLOY-API.md).

| Item | Value |
|---|---|
| Dockerfile API | `Dockerfile` (racine, target `production`) |
| GHCR images | `ghcr.io/anthonymarcelin/atasoif-{api,site,ops}:<full-sha>` |
| Workflow | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) → [`deploy-prod.yml`](../.github/workflows/deploy-prod.yml) |
| Dokploy | **Application** Docker (pull) — pas Compose · pas webhook `latest` |
| Secrets | `DOKPLOY_API_TOKEN`, `DOKPLOY_*_APPLICATION_ID`, Tailscale — noms dans [`DEPLOY-PROD.md`](./DEPLOY-PROD.md) |

`dev` merges do **not** deploy. Deploy = merge **`dev` → `main`** (accord explicite) ou `workflow_dispatch` sur `main`. Path filters : un changement `apps/site` ne redéploie **que** site (idem api / ops).

## Angular cave app (`apps/web`) — not deployed yet

Production builds already target API **`https://api.atasoif.fr`**. There is **no** GHCR image / Dokploy service for `apps/web` yet.

**Proposal (Anthony must confirm before creating anything):** [`docs/DOKPLOY-WEB.md`](./DOKPLOY-WEB.md) — same pattern as site (`nginx` static → `ghcr.io/…/atasoif-web` → Dokploy Application under **À ta soif**). Until then, local/CI smoke = `bun run build:web`.

When the cave app has a public origin, add it to API `CORS_ORIGIN` (and set `FRONTEND_URL` for mail/OAuth deep links).

## Marketing site (`apps/site`) → GHCR → Dokploy

La landing Astro (pages prerender + endpoint waitlist Resend) a son **propre** image Node standalone. CI builds and pushes it; **Dokploy does not build from git**.

| Item | Value |
|---|---|
| Dockerfile | `apps/site/Dockerfile` (context = monorepo **root** `.`) |
| GHCR image | **`ghcr.io/anthonymarcelin/atasoif-site`** |
| Runtime | Node 22 · `node ./dist/server/entry.mjs` + `npm install --omit=dev` · port **80** |
| Tags | `<full-sha>` on pushes to **`main`** when `apps/site/**` changes |
| Workflow | [`ci.yml`](../.github/workflows/ci.yml) → [`deploy-prod.yml`](../.github/workflows/deploy-prod.yml) |
| Trigger | **`push` / merge sur `main`** (path filters) + `workflow_dispatch` |
| Dokploy provider | **Docker** (pull prebuilt image) — **not** Nixpacks, **not** Dockerfile-from-git |

### Local build (debug)

```bash
# Build context = monorepo root (required for bun.lock + workspace stubs)
docker build -f apps/site/Dockerfile -t atasoif-site \
  --build-arg PUBLIC_SITE_URL=https://atasoif.fr \
  --build-arg PUBLIC_CTA_MODE=waitlist \
  .
```

`PUBLIC_*` are **bake-time** build args (HTML/CTA). **Resend secrets are runtime** — set them in Dokploy env (not as Docker build-args).

### Dokploy service `site`

GitHub App is already installed on Dokploy **and** on `AnthonyMarcelin/atasoif-v2` (same integration as Spawnzone for git). The **`site`** service still uses Provider **Docker** and pulls **À ta soif’s own** GHCR package — not a Spawnzone image.

| Field | Value |
|---|---|
| Name | `site` |
| Provider | **Docker** (pull image) |
| Docker image | `ghcr.io/anthonymarcelin/atasoif-site:<full-sha>` (CI updates via Dokploy API) |
| Port | **80** |
| Registry | Prefer **Public** package `atasoif-site` → anonymous pull, no extra registry form. If **Private**, select the **existing Dokploy GHCR** registry (same `ghcr.io` creds already used for Spawnzone pulls) — do **not** invent a new PAT unless that registry is missing |
| Auto-deploy | **off** for Git / `latest` webhooks — CI sets sha + deploy |

#### Runtime env (Dokploy → Environment)

Paste into the `site` application (never commit values):

| Variable | Required | Example / notes |
|---|---|---|
| `RESEND_API_KEY` | **Yes** (waitlist) | Resend dashboard API key |
| `RESEND_FROM` | No | `À ta soif <noreply@atasoif.fr>` (verified domain; noreply inbox unread) |
| `RESEND_REPLY_TO` | No | `contact@atasoif.fr` (keep this; replies must not go to noreply) |
| `WAITLIST_NOTIFY_TO` | No | `contact@atasoif.fr` · empty string disables internal copy |

DNS for Resend: verify `atasoif.fr` (SPF + DKIM TXT) in [Resend Domains](https://resend.com/domains). API mail stays on OVH SMTP. Resend is **site only**.

Do **not** configure Build type Dockerfile / Nixpacks / monorepo context in Dokploy for this service. Rebuilds happen in GitHub Actions on **`main`** (path filters) or via **workflow_dispatch**. Merges to `dev` do **not** deploy the site.

### Auto-deploy after GHCR push (Dokploy API)

Site, API et ops partagent le même job Dokploy (Tailscale + `DOKPLOY_API_TOKEN` + application ids). Plus de webhook `latest`. Voir [`DEPLOY-PROD.md`](./DEPLOY-PROD.md).

#### After the first GHCR push (Anthony)

1. **Settings → Actions → General → Workflow permissions** → **Read and write**.
2. Packages `atasoif-api` / `atasoif-site` (+ `atasoif-ops` later) linked to this repo; GHCR registry on Dokploy if Private.
3. Checklist secrets + disable `latest` webhooks : [`DEPLOY-PROD.md`](./DEPLOY-PROD.md).
4. Optional repo **Actions variables**: `PUBLIC_SITE_URL`, `PUBLIC_CTA_MODE`, `PUBLIC_IOS_URL`, `PUBLIC_ANDROID_URL`.

## Files

| File | Role |
|---|---|
| `Dockerfile` | Multi-stage AdonisJS 7 API image (Bun install in build stages; Node 24 runtime; `@atasoif/shared` vendored) |
| `apps/site/Dockerfile` | Astro prerender + Node standalone waitlist API (CI → GHCR) |
| `docs/DEPLOY-PROD.md` | Uniform prod deploy + Dokploy checklist (api / site / ops) |
| `docs/DOKPLOY-WEB.md` | Proposal: Angular cave SPA → GHCR → Dokploy (Anthony confirm before create) |
| `.github/workflows/ci.yml` | Lint / typecheck / tests / build · publish on `main` |
| `.github/workflows/deploy-prod.yml` | Path-filtered GHCR sha + Dokploy + smoke + rollback |
| `apps/api/docker-entrypoint.sh` | Opt-in Lucid migrate (`RUN_MIGRATIONS=1`) then `node bin/server.js` |
| `docs/DOKPLOY-API.md` | Dokploy service `api` (GHCR, PostGIS, env, secrets) |
| `docker-compose.yml` | Shared `postgres` + `api` |
| `docker-compose.dev.yml` | Local overrides |
| `docker-compose.prod.yml` | OVH / prod-like overrides |
| `.dockerignore` | Keeps web, docs, and secrets out of the build context |

## Commands

```bash
bun run docker:dev     # API + Postgres (dev overlay)
bun run docker:prod    # API + Postgres (prod overlay, reads `.env`)
bun run docker:down    # stop the dev stack
```

Equivalent:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env up -d --build
```

## Bun vs Node in the image

| Step | Tool |
|---|---|
| `bun install --frozen-lockfile --filter @atasoif/api` | Bun (build stage) |
| `node ace build --package-manager=bun` | Node |
| `bun install --production` inside `build/` | Bun (build stage) |
| Entrypoint (optional migrate) + `node bin/server.js` | Node (`node:24-alpine`) |
| Postgres | unchanged (`postgres:16-alpine`) |

Details: [`docs/BUN.md`](./BUN.md).

## Compose project name

The Compose project is explicitly named **`atasoif`** (`name: atasoif` in `docker-compose.yml`).

## Ports

| Environment | Service | Host → container | Notes |
|---|---|---|---|
| **Dev** | Postgres | **5432 → 5432** | Standard Postgres port on the host |
| **Dev** | API | **3000 → 3000** | `GET /health` |
| **Dev** | Mailpit | **1025 → 1025** (SMTP), **8025 → 8025** (UI) | Catch verify/reset emails locally |
| **Prod** | Postgres | *(not published)* | Reachable only on the Compose network as hostname `postgres` |
| **Prod** | API | `${API_PORT:-3000} → 3000` | Put TLS reverse proxy in front later (E0.7) |
| **Dokploy** | Site | host → **80** | Prebuilt GHCR image `atasoif-site` |
| **Dokploy** | API | host → **3000** | Prebuilt GHCR image `atasoif-api` · DB `infra-postgis-rfekdz` · see [`DOKPLOY-API.md`](./DOKPLOY-API.md) |

## `DB_*` cheat sheet

| How you run | `DB_HOST` |
|---|---|
| Adonis on host + Postgres via `docker:dev` | `localhost` |
| Full `docker:dev` / `docker:prod` (API in container) | `postgres` |

See `.env.example`. Required runtime vars include `APP_KEY` (generate with `node ace generate:key` in `apps/api`).

## Recommended day-to-day workflow

1. Start Postgres + Mailpit (or full stack) via `bun run docker:dev`.
2. Point `apps/api/.env` at `DB_HOST=localhost`, `SMTP_HOST=localhost`, `SMTP_PORT=1025`.
3. Iterate with `bun run dev:api` / `bun run dev:web` on the host (Bun + Node ≥ 24).
4. Open Mailpit UI at `http://localhost:8025` to inspect verification / reset mails.
5. Use full `bun run docker:dev` when you want to validate the same topology as production (API uses `SMTP_HOST=mailpit`).

## Health check

```bash
curl -s http://localhost:3000/health
# {"app":"atasoif-api",…,"database":"up","status":"ok"}
```

On API start, the entrypoint boots Adonis. Lucid migrations run **only** when `RUN_MIGRATIONS=1` (enabled in `docker-compose.dev.yml`; off by default for Dokploy / prod-like Compose to protect live data).

## Out of scope (for now)

- Caddy/Nginx TLS termination → epic **E0.7**
- Containerizing Angular or Capacitor iOS/Android builds
- Kubernetes
