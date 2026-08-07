# E0-T10 — Docker Compose API + Postgres (dev & prod)

| | |
|---|---|
| **Type** | chore / infra |
| **Priority** | Must (before OVH) |
| **Epic** | E0 |
| **Status** | Done (updated for AdonisJS 7) |

## Goal

Run **API + Postgres** via Docker Compose for local **dev** and **prod** (OVH). Capacitor / Angular native builds stay outside Docker.

## Acceptance criteria

- [x] `Dockerfile` multi-stage for AdonisJS 7 API (Node 24, `ace build`)
- [x] Base `docker-compose.yml` with `postgres` + `api`
- [x] `docker-compose.dev.yml` overrides (ports, rebuild-friendly)
- [x] `docker-compose.prod.yml` overrides (restart, no host DB port exposure by default)
- [x] Prod entrypoint runs Lucid `migration:run --force` then starts API
- [x] `.env.example` documents host vs Docker `DB_*` + `APP_KEY`
- [x] Root scripts `docker:dev` / `docker:prod`
- [x] Docs in README + [`docs/DOCKER.md`](../DOCKER.md)
- [x] Verified: `GET /health` → `database: up` on host Adonis; Docker rebuild after Adonis swap

## Out of scope

- Caddy/Nginx TLS (later E0.7)
- Containerizing Angular / Capacitor
- Kubernetes
