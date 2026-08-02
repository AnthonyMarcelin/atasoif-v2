# Docker — API + Postgres

Containerize **API + database** only. Angular/Capacitor stay on the host for native store builds.

## Files

| File | Role |
|---|---|
| `Dockerfile` | Multi-stage Nest API image (`@atasoif/shared` + Prisma generate + build) |
| `apps/api/docker-entrypoint.sh` | `prisma migrate deploy` then start Nest |
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

If OrbStack still shows an orphan **`atasoif-v2`** group (from early folder-named runs), remove it — only **`atasoif`** should remain.

## Ports

| Environment | Service | Host → container | Notes |
|---|---|---|---|
| **Dev** | Postgres | **5432 → 5432** | Standard Postgres port on the host |
| **Dev** | API | **3000 → 3000** | `GET /health` |
| **Prod** | Postgres | *(not published)* | Reachable only on the Compose network as hostname `postgres` |
| **Prod** | API | `${API_PORT:-3000} → 3000` | Put TLS reverse proxy in front later (E0.7) |

Inside the Compose network, the API always uses:

```text
postgresql://…@postgres:5432/atasoif_v2
```

If host **5432** is already taken by another Postgres, stop that service or temporarily remap in `docker-compose.dev.yml`.

## `DATABASE_URL` cheat sheet

| How you run | `DATABASE_URL` host |
|---|---|
| Nest on host + Postgres via `docker:dev` | `localhost:5432` |
| Full `docker:dev` / `docker:prod` (API in container) | `postgres:5432` |

See `.env.example`.

## Recommended day-to-day workflow

1. Start stack (or Postgres only via the same compose files).
2. Point local `.env` at `localhost:5432`.
3. Iterate with `pnpm dev:api` / `pnpm dev:web` on the host (faster reload).
4. Use full `pnpm docker:dev` when you want to validate the same topology as production.

## Health check

```bash
curl -s http://localhost:3000/health
# {"app":"atasoif-api",…,"database":"up","status":"ok"}
```

On API start, the entrypoint applies pending Prisma migrations (`migrate deploy`), then boots Nest.

## Out of scope (for now)

- Caddy/Nginx TLS termination → epic **E0.7**
- Containerizing Angular or Capacitor iOS/Android builds
- Kubernetes
