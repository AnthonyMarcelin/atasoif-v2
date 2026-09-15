# Docker — API + Postgres

Containerize **API + database** only. Angular/Capacitor stay on the host for native store builds.

## Files

| File | Role |
|---|---|
| `Dockerfile` | Multi-stage AdonisJS 7 API image (Node 24, `node ace build`, start from `build/`) |
| `apps/api/docker-entrypoint.sh` | `node ace migration:run --force` then `node bin/server.js` |
| `docker-compose.yml` | Shared `postgres` + `api` |
| `docker-compose.dev.yml` | Local overrides |
| `docker-compose.prod.yml` | OVH / prod-like overrides |
| `.dockerignore` | Keeps web, docs, and secrets out of the build context |

## Commands

```bash
pnpm docker:dev     # API + Postgres (dev overlay)
pnpm docker:prod    # API + Postgres (prod overlay, reads `.env`)
pnpm docker:down    # stop the dev stack
```

Equivalent:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env up -d --build
```

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

## `DB_*` cheat sheet

| How you run | `DB_HOST` |
|---|---|
| Adonis on host + Postgres via `docker:dev` | `localhost` |
| Full `docker:dev` / `docker:prod` (API in container) | `postgres` |

See `.env.example`. Required runtime vars include `APP_KEY` (generate with `node ace generate:key` in `apps/api`).

## Recommended day-to-day workflow

1. Start Postgres + Mailpit (or full stack) via `pnpm docker:dev`.
2. Point `apps/api/.env` at `DB_HOST=localhost`, `SMTP_HOST=localhost`, `SMTP_PORT=1025`.
3. Iterate with `pnpm dev:api` / `pnpm dev:web` on the host (Node ≥ 24).
4. Open Mailpit UI at `http://localhost:8025` to inspect verification / reset mails.
5. Use full `pnpm docker:dev` when you want to validate the same topology as production (API uses `SMTP_HOST=mailpit`).

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
