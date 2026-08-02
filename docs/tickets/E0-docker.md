# E0-T10 — Docker Compose API + Postgres (dev & prod)

| | |
|---|---|
| **Type** | chore / infra |
| **Priority** | Must (before OVH) |
| **Epic** | E0 |
| **Status** | Done |

## Goal

Run **API + Postgres** via Docker Compose for local **dev** and **prod** (OVH). Capacitor / Angular native builds stay outside Docker.

## Acceptance criteria

- [x] `Dockerfile` multi-stage for Nest API (+ `@atasoif/shared`)
- [x] Base `docker-compose.yml` with `postgres` + `api`
- [x] `docker-compose.dev.yml` overrides (ports, rebuild-friendly)
- [x] `docker-compose.prod.yml` overrides (restart, no host DB port exposure by default)
- [x] Prod entrypoint runs `prisma migrate deploy` then starts API
- [x] `.env.example` documents host vs Docker `DATABASE_URL`
- [x] Root scripts `docker:dev` / `docker:prod`
- [x] Docs in README + [`docs/DOCKER.md`](../DOCKER.md) (incl. host port **5433** rationale)
- [x] Verified: `GET /health` → `database: up` on `docker:dev`

## Out of scope

- Caddy/Nginx TLS (later E0.7)
- Containerizing Angular / Capacitor
- Kubernetes

## Port note (dev)

Host **5433 → container 5432** for Postgres so local setups that already use **5432** do not break Compose (`Bind … 5432 failed`). See `docs/DOCKER.md`.
