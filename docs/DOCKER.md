# Docker — API + Postgres (+ site séparément)

Containerize **API + database** only in Compose. Angular/Capacitor stay on the host for native store builds.

## Marketing site (`apps/site`) → GHCR → Dokploy

La landing Astro static a son **propre** image nginx. CI builds and pushes it; **Dokploy does not build from git**.

| Item | Value |
|---|---|
| Dockerfile | `apps/site/Dockerfile` (context = monorepo **root** `.`) |
| GHCR image | **`ghcr.io/anthonymarcelin/atasoif-site`** |
| Tags | `latest` on pushes to `dev` · also short/long `sha-*` |
| Workflow | [`.github/workflows/site-ghcr.yml`](../.github/workflows/site-ghcr.yml) |
| Dokploy provider | **Docker** (pull prebuilt image) — **not** Nixpacks, **not** Dockerfile-from-git |

### Local build (debug)

```bash
# Build context = monorepo root (required for bun.lock + workspace stubs)
docker build -f apps/site/Dockerfile -t atasoif-site \
  --build-arg PUBLIC_SITE_URL=https://atasoif.fr \
  --build-arg PUBLIC_CTA_MODE=waitlist \
  .
```

`PUBLIC_*` are **bake-time** build args (Astro static). Runtime ENV in Dokploy will **not** rewrite built HTML/JS.

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

Do **not** configure Build type Dockerfile / Nixpacks / monorepo context in Dokploy for this service. Rebuilds happen in GitHub Actions on `dev` (path filters) or via **workflow_dispatch** (override `PUBLIC_*` inputs).

### Auto-deploy after GHCR push (Tailscale → Dokploy webhook)

GitHub-hosted runners are **not** on the Tailscale mesh (VPS + Mac are). After a successful `atasoif-site` push, job **`notify-dokploy`** in [`.github/workflows/site-ghcr.yml`](../.github/workflows/site-ghcr.yml):

1. Joins the tailnet via [`tailscale/github-action`](https://github.com/tailscale/github-action) `@v4`
2. `POST`s the Dokploy deploy webhook URL stored in secrets (never commit the URL or token)

`continue-on-error: false` — if Tailscale comes up and the webhook fails, the workflow **fails loudly**.

#### Required GitHub Actions secrets

Settings → Secrets and variables → Actions → **New repository secret**.

| Secret | Required | Purpose |
|---|---|---|
| `DOKPLOY_SITE_DEPLOY_WEBHOOK` | **Yes** | Full Dokploy deploy webhook URL (Tailscale IP, e.g. `http://100.x.y.z:3000/api/deploy/...`). Copy from Dokploy service `site` — do **not** put it in the repo. |
| `TS_OAUTH_CLIENT_ID` | One of the Tailscale auth options | Tailscale OAuth client ID (`auth_keys` scope, tags include `tag:ci`) |
| `TS_OAUTH_SECRET` | With OAuth | Tailscale OAuth client secret |
| `TS_AUTHKEY` | **Or** instead of OAuth | Reusable auth key tagged for CI (`tag:ci`), **ephemeral** (and pre-approved if the tailnet uses device approval) |

**Prefer** OAuth (`TS_OAUTH_CLIENT_ID` + `TS_OAUTH_SECRET`) so CI nodes stay ephemeral without a long-lived key. If you use `TS_AUTHKEY` instead, leave the OAuth secrets unset.

Tailscale ACL / tag owners must allow `tag:ci` (and that tag must reach Dokploy on the VPS over Tailscale).

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
| `Dockerfile` | Multi-stage AdonisJS 7 API image (Bun install in build stages; Node 24 runtime) |
| `apps/site/Dockerfile` | Astro static → nginx (built in CI → GHCR) |
| `.github/workflows/site-ghcr.yml` | Build/push `ghcr.io/anthonymarcelin/atasoif-site` + Tailscale → Dokploy webhook |
| `apps/api/docker-entrypoint.sh` | `node ace migration:run --force` then `node bin/server.js` |
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
| Entrypoint migrations + `node bin/server.js` | Node (`node:24-alpine`) |
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

On API start, the entrypoint applies pending Lucid migrations, then boots Adonis.

## Out of scope (for now)

- Caddy/Nginx TLS termination → epic **E0.7**
- Containerizing Angular or Capacitor iOS/Android builds
- Kubernetes
