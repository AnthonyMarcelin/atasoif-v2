# Docker — API + Postgres (+ site séparément)

Containerize **API + database** only in Compose. Angular/Capacitor stay on the host for native store builds.

## Production Dokploy — API

API Adonis en prod : image **`ghcr.io/anthonymarcelin/atasoif-api`**, trigger **`main`**, webhook Tailscale → Dokploy.

**Guide complet (service, réseau PostGIS, env, secrets) :** [`docs/DOKPLOY-API.md`](./DOKPLOY-API.md).

| Item | Value |
|---|---|
| Dockerfile | `Dockerfile` (racine, target `production`) |
| GHCR image | **`ghcr.io/anthonymarcelin/atasoif-api`** |
| Tags | `latest` + `sha-<short>` on pushes to **`main`** |
| Workflow | [`.github/workflows/api-ghcr.yml`](../.github/workflows/api-ghcr.yml) |
| Dokploy | **Application** Docker (pull) — pas Compose |
| Secret webhook | `DOKPLOY_API_DEPLOY_WEBHOOK` (+ Tailscale secrets — **API only**; site uses HTTPS webhook) |

`dev` merges do **not** deploy the API or the site. Deploy = merge **`dev` → `main`** (accord explicite) ou `workflow_dispatch`. Site and API both trigger on **`main`** for prod.

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
| Tags | `latest` on pushes to **`main`** · also short/long `sha-*` |
| Workflow | [`.github/workflows/site-ghcr.yml`](../.github/workflows/site-ghcr.yml) |
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
| Docker image | `ghcr.io/anthonymarcelin/atasoif-site:latest` |
| Port | **80** |
| Registry | Prefer **Public** package `atasoif-site` → anonymous pull, no extra registry form. If **Private**, select the **existing Dokploy GHCR** registry (same `ghcr.io` creds already used for Spawnzone pulls) — do **not** invent a new PAT unless that registry is missing |
| Auto-deploy | optional (watch image tag / Dokploy pull) |

#### Runtime env (Dokploy → Environment)

Paste into the `site` application (never commit values):

| Variable | Required | Example / notes |
|---|---|---|
| `RESEND_API_KEY` | **Yes** (waitlist) | Resend dashboard API key |
| `RESEND_FROM` | No | `À ta soif <noreply@atasoif.fr>` (verified domain; noreply inbox unread) |
| `RESEND_REPLY_TO` | No | `contact@atasoif.fr` (keep this; replies must not go to noreply) |
| `WAITLIST_NOTIFY_TO` | No | `contact@atasoif.fr` · empty string disables internal copy |

DNS for Resend: verify `atasoif.fr` (SPF + DKIM TXT) in [Resend Domains](https://resend.com/domains). API mail stays on OVH SMTP. Resend is **site only**.

Do **not** configure Build type Dockerfile / Nixpacks / monorepo context in Dokploy for this service. Rebuilds happen in GitHub Actions on **`main`** (path filters) or via **workflow_dispatch** (override `PUBLIC_*` inputs). Merges to `dev` do **not** deploy the site.

### Auto-deploy after GHCR push (HTTPS Dokploy webhook)

After a successful `atasoif-site` push, job **`notify-dokploy`** in [`.github/workflows/site-ghcr.yml`](../.github/workflows/site-ghcr.yml) `POST`s `{}` to the Dokploy deploy webhook URL stored in secrets (never commit the URL or token). **No Tailscale join** for the site workflow.

**Set the secret:** GitHub Actions → `DOKPLOY_SITE_DEPLOY_WEBHOOK` = the **HTTPS Application deploy webhook** from Dokploy service **`site`** (copy from Dokploy UI). Prefer the public HTTPS URL, not a Tailscale `http://100.x…` URL. Never commit or paste the full URL/token into the repo, PRs, or docs.

Site notify does **not** join Tailscale. A Tailscale-only URL would only work if the runner could already reach that host. (API notify may still use Tailscale — see [`DOKPLOY-API.md`](./DOKPLOY-API.md).)

`continue-on-error: false` — missing secret or non-2xx webhook response **fails loudly**.

#### Required GitHub Actions secrets (site)

Settings → Secrets and variables → Actions → **New repository secret**.

| Secret | Required | Purpose |
|---|---|---|
| `DOKPLOY_SITE_DEPLOY_WEBHOOK` | **Yes** | HTTPS Application deploy webhook from Dokploy service `site` — do **not** put it in the repo. |
| `DOKPLOY_API_DEPLOY_WEBHOOK` | For API deploys | API webhook (+ Tailscale secrets) — see [`DOKPLOY-API.md`](./DOKPLOY-API.md). |

Site notify does **not** need `TS_*` secrets. Those remain for the **API** workflow only.

#### After the first GHCR push (Anthony)

New container packages default to **private** and are **linked** to this repo when CI pushes with `GITHUB_TOKEN`.

1. **Settings → Actions → General → Workflow permissions** → **Read and write** (needed for the first / ongoing package publish).
2. Open the new package **`atasoif-site`** → confirm it is linked to **`AnthonyMarcelin/atasoif-v2`**. If not: Package settings → connect repository.
3. **Recommended visibility for this marketing image:** Package settings → **Change visibility → Public** (irreversible). Then Dokploy Docker pull works with the existing GitHub App setup and **without** new registry secrets.
4. If you keep it **Private**: reuse Dokploy’s existing **GHCR** registry entry; ensure that credential can `read:packages` for `atasoif-site`. Optionally Package settings → **Manage Actions access** → `atasoif-v2` **Write** if a later workflow push is denied.
5. In Dokploy project **À ta soif** → service `site` → image `ghcr.io/anthonymarcelin/atasoif-site:latest` → Deploy.

Optional repo **Actions variables** (Settings → Variables): `PUBLIC_SITE_URL`, `PUBLIC_CTA_MODE`, `PUBLIC_IOS_URL`, `PUBLIC_ANDROID_URL`. Defaults match waitlist launch (`https://atasoif.fr`, `waitlist`, `#ios`, `#android`).

## Files

| File | Role |
|---|---|
| `Dockerfile` | Multi-stage AdonisJS 7 API image (Bun install in build stages; Node 24 runtime; `@atasoif/shared` vendored) |
| `apps/site/Dockerfile` | Astro prerender + Node standalone waitlist API (CI → GHCR) |
| `docs/DOKPLOY-WEB.md` | Proposal: Angular cave SPA → GHCR → Dokploy (Anthony confirm before create) |
| `.github/workflows/api-ghcr.yml` | Build/push `ghcr.io/anthonymarcelin/atasoif-api` on **`main`** + Tailscale → Dokploy webhook |
| `.github/workflows/site-ghcr.yml` | Build/push `ghcr.io/anthonymarcelin/atasoif-site` on **`main`** + HTTPS Dokploy webhook (no Tailscale) |
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
