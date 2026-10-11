# Production deploy — CI → GHCR `:sha` → Dokploy → smoke → rollback

Uniform prod path for **`api`**, **`site`**, and **`ops`** (same idea as Spawnzone / Médoc Vibes).  
Issue: [#114](https://github.com/AnthonyMarcelin/atasoif-v2/issues/114).

| Rule | Detail |
|---|---|
| Trigger | Push / merge to **`main` only** (after green CI). Never from `dev`. |
| Scope | Path-filtered: change `apps/site/**` → deploy **site only**; `apps/api/**` → **api only**; `apps/ops/**` → **ops only**. |
| Images | `ghcr.io/anthonymarcelin/atasoif-{api,site,ops}:<full-sha>` — **not** `:latest` for prod pull |
| DB | `RUN_MIGRATIONS` stays **`0` / unset** on Dokploy. Deploy never runs migrate/seed/wipe. |
| Secrets | GitHub Secrets / Dokploy env only — never commit values |

Workflows: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) · [`.github/workflows/deploy-prod.yml`](../.github/workflows/deploy-prod.yml).

`apps/ops` may not exist yet: detect + publish + Dokploy hooks are scaffolded; publish skips until `apps/ops/Dockerfile` exists.

---

## GitHub — variables & secrets (names only)

Settings → Secrets and variables → Actions.

### Repository variable

| Name | Purpose |
|---|---|
| `DOKPLOY_URL` | Dokploy base URL reachable over Tailscale (no trailing slash required) |

Optional bake-time site vars (unchanged): `PUBLIC_SITE_URL`, `PUBLIC_CTA_MODE`, `PUBLIC_IOS_URL`, `PUBLIC_ANDROID_URL`.

### Repository secrets

| Name | Purpose |
|---|---|
| `DOKPLOY_API_TOKEN` | Dokploy API token dedicated to CI (`x-api-key`) |
| `DOKPLOY_API_APPLICATION_ID` | Dokploy Application id for **`api`** |
| `DOKPLOY_SITE_APPLICATION_ID` | Dokploy Application id for **`site`** |
| `DOKPLOY_OPS_APPLICATION_ID` | Dokploy Application id for **`ops`** (when the service exists) |
| `TS_OAUTH_CLIENT_ID` + `TS_OAUTH_SECRET` | Tailscale OAuth (`auth_keys` + `tag:ci`) — preferred |
| `TS_AUTHKEY` | **Or** reusable ephemeral Tailscale auth key with `tag:ci` |

If token / URL / Tailscale / the relevant application id are missing, GHCR still publishes; the Dokploy job **skips** with a clear log (no invented tokens).

**Deprecated (remove after cutover):** `DOKPLOY_API_DEPLOY_WEBHOOK`, `DOKPLOY_SITE_DEPLOY_WEBHOOK` — old `latest` webhook workflows are gone.

---

## Manual Dokploy checklist (Anthony)

Do this **once** before relying on auto-deploy from `main`. Do not commit any token or URL.

1. **Disable** Git auto-deploy and **`latest` image webhooks** on Applications `api`, `site`, and `ops` (when present).
2. Create a **Dokploy API token** for CI → GitHub secret `DOKPLOY_API_TOKEN`.
3. Set GitHub variable `DOKPLOY_URL` (Tailscale host, e.g. `http://100.x.y.z:3000`).
4. Copy each Application **id** into `DOKPLOY_API_APPLICATION_ID` / `DOKPLOY_SITE_APPLICATION_ID` / `DOKPLOY_OPS_APPLICATION_ID`.
5. Ensure Tailscale CI credentials exist (`TS_OAUTH_*` or `TS_AUTHKEY`).
6. Point each Application at GHCR image **with a concrete sha tag** once (after first CI publish), e.g. `ghcr.io/anthonymarcelin/atasoif-api:<sha>` — CI will update `dockerImage` via API afterward.
7. Per Application Swarm / Update Config (when available in UI):
   - Healthcheck aligned on the health route (`api`: `/health` port `3000`; `site`: `/` port `80`)
   - `FailureAction=rollback`
   - `Monitor=120s`
   - `Order=start-first`
8. Confirm Postgres is on a **named volume** / shared infra DB — **not** wiped by app redeploys.
9. On **`api` env**: `RUN_MIGRATIONS` is **`0` or absent** (entrypoint must not migrate on every boot).
10. Repo → Actions → Workflow permissions → **Read and write** (GHCR push with `GITHUB_TOKEN`).

---

## Smoke & rollback

| Service | Routes file | Base URL |
|---|---|---|
| api | [`.github/smoke-routes/api.txt`](../.github/smoke-routes/api.txt) | `https://api.atasoif.fr` |
| site | [`.github/smoke-routes/site.txt`](../.github/smoke-routes/site.txt) | `https://atasoif.fr` |
| ops | [`.github/smoke-routes/ops.txt`](../.github/smoke-routes/ops.txt) | `https://ops.atasoif.fr` |

- Exact **HTTP 200** (no redirect follow; 18× every 5s; 20s timeout).
- Only services deployed in that run are smoked.
- On failure: restore **that service’s** previous `dockerImage` only; job stays red.

---

## Schema changes (not auto-deploy)

Prod schema is **manual / deliberate**:

1. `pg_dump` the prod DB (ops machine / Dokploy exec).
2. Apply forward-only Lucid migrations inside the API container when ready (`node ace migration:run --force`), or temporarily set `RUN_MIGRATIONS=1` for a single controlled restart, then set it back to `0`.
3. Never `migration:fresh`, `db:wipe`, `db:seed`, or `docker compose down -v` on prod.
4. `category_seeder` / `migrate:v1` stay one-shot ops, guarded against careless `NODE_ENV=production` use.

---

## Local checks

```bash
# Path detection dry-run
bash .github/scripts/detect-prod-targets.sh <base_sha> HEAD

# Smoke against live prod (read-only)
DEPLOY_API=true DEPLOY_SITE=false DEPLOY_OPS=false bash .github/scripts/prod-smoke.sh
```
