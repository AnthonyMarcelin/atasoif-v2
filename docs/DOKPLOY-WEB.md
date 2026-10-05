# Dokploy — Angular cave app (`apps/web`) · proposal

**Status:** documented proposal only. **Do not create** a Dokploy service until Anthony confirms (Anthony fence — no new Dokploy services outside À ta soif without approval).

**Preferred holiday distribution:** Capacitor → **TestFlight** (and later Play), not a public `app.` / `cave.` Dokploy SPA. See [`CAPACITOR-IOS-TESTFLIGHT.md`](./CAPACITOR-IOS-TESTFLIGHT.md).

There is **no** `web` GHCR workflow and **no** `apps/web` Dockerfile yet. Production API URL is already baked into the Angular production environment (`https://api.atasoif.fr`). A Dokploy SPA host remains optional / deferred.

| Item | Proposed value |
|---|---|
| App | `apps/web` (Angular 20 cellar SPA) |
| Pattern | Same as site: **GHCR image → Dokploy Application (Docker pull)** |
| Suggested image | `ghcr.io/anthonymarcelin/atasoif-web` |
| Suggested service name | `web` (project **À ta soif** only) |
| Suggested domain | TBD — e.g. `app.atasoif.fr` (must **not** collide with marketing `atasoif.fr` / `www.atasoif.fr`) |
| Port | **80** (nginx static, same shape as `apps/site`) |
| Trigger | Prefer **`main`** (align with API + site) |
| Webhook secret | `DOKPLOY_WEB_DEPLOY_WEBHOOK` (HTTPS Application webhook, never commit) |

## Why not implemented in this PR

- No existing Dokploy `web` service.
- [`docs/DOCKER.md`](./DOCKER.md) still scopes Compose to API + Postgres; Angular hosting is explicit follow-up.
- Creating GHCR + Dokploy without a confirmed domain/CORS origin would ship a dead URL.

## API coupling (already in code)

| Build | File | `apiBaseUrl` |
|---|---|---|
| Production (`ng build` default) | `apps/web/src/environments/environment.ts` | `https://api.atasoif.fr` |
| Development (`ng serve`) | `environment.development.ts` via `fileReplacements` | `http://localhost:3000` |

Relative photo paths (`/api/v1/media/off/…`, shelf `/api/v1/collection/…/photo`) are resolved with `absoluteApiUrl(..., environment.apiBaseUrl)` and fetched with the Bearer token (`BottlePhoto`).

## Local / CI smoke (no Dokploy)

```bash
# From monorepo root
bun install
bun run build:shared
bun run build:web
# Artifacts: apps/web/dist/web
```

Serve the dist with any static server and open the SPA origin in a browser. API calls hit `https://api.atasoif.fr` — CORS must allow that SPA origin (see below).

## When Anthony approves — checklist

1. **Confirm domain** for the cave app (recommend `app.atasoif.fr`).
2. **Dokploy** (project **À ta soif** only): Application → Provider **Docker** → image `ghcr.io/anthonymarcelin/atasoif-web:latest` → port **80** → domain + HTTPS.
3. **CORS / deep links** on API service env:
   - `CORS_ORIGIN` — CSV including the new web origin **and** existing marketing origins as needed  
     Example: `https://app.atasoif.fr,https://www.atasoif.fr,https://atasoif.fr`
   - `FRONTEND_URL` — set to the cave app origin (verify / reset / OAuth callback redirects)
4. **CI** (follow-up PR after approval):
   - `apps/web/Dockerfile` (Bun build `@atasoif/web` + shared → nginx SPA, mirror `apps/site`)
   - `.github/workflows/web-ghcr.yml` (build/push + HTTPS Dokploy webhook notify)
   - Adjust `.dockerignore` so the web image context can copy `apps/web` sources (today `apps/web/**` is excluded for API/site builds)
5. Wire secret `DOKPLOY_WEB_DEPLOY_WEBHOOK`.
6. Smoke: register/login → search → add → bottle photo from `/api/v1/media/off/…`.

## Interim (before Dokploy)

- Preview: `bun run build:web` + static host / tunnel; add that preview origin to `CORS_ORIGIN`.
- Capacitor later (E5) will use the same production `apiBaseUrl` until a native-specific env is introduced.
