# Dokploy — API Adonis (`atasoif-api`) · GHCR

Déploiement **production** de l’API via image prébuildée GHCR + webhook Dokploy.

| Item | Value |
|---|---|
| Image | **`ghcr.io/anthonymarcelin/atasoif-api`** |
| Dockerfile | `Dockerfile` (racine, target `production`, context `.`) |
| Entrypoint | `apps/api/docker-entrypoint.sh` → boot `node bin/server.js` · Lucid migrate **opt-in** via `RUN_MIGRATIONS=1` |
| Tags | **`latest`** (Dokploy pull) · **`sha-<short>`** (audit / rollback) |
| Workflow | [`.github/workflows/api-ghcr.yml`](../.github/workflows/api-ghcr.yml) |
| Trigger | **`push` / merge sur `main`** (path filters API / shared / Docker) + `workflow_dispatch` |
| Dokploy type | **Application** · provider **Docker** (pull) — **pas** Compose, **pas** Nixpacks, **pas** build git |
| Domaine | **`api.atasoif.fr`** |

## Décision produit — Application Docker (pas Compose)

Le service Dokploy `api` doit être une **Application** avec provider **Docker** qui pull `ghcr.io/anthonymarcelin/atasoif-api:latest`.

Ne pas utiliser un service **Compose** (chemin git + `docker-compose.yml`) : le CI pousse déjà une image prête ; Compose ajouterait un couplage git inutile et un webhook d’un autre type (voir § Webhook).

---

## Branch trigger — `main` (prod), pas `dev`

| App | Workflow | Branch qui déploie |
|---|---|---|
| **API** (ce doc) | `api-ghcr.yml` | **`main`** |
| Site (landing) | `site-ghcr.yml` | **`main`** (HTTPS webhook, pas Tailscale — voir [`docs/DOCKER.md`](./DOCKER.md)) |

**Deploy API = merge `dev` → `main`** (ou **workflow_dispatch** sur `api-ghcr.yml` depuis `main`).

Un merge PR → `dev` **ne déploie pas** l’API. Ne pas merger `dev` → `main` sans accord explicite.

Ne lance **pas** `migrate:v1` depuis l’entrypoint — migration v1 = commande Ace one-shot **après** service up + seed catégories.

**Prod data protection:** leave `RUN_MIGRATIONS` unset or `0` on Dokploy so redeploys do **not** run `migration:run`. Apply schema deliberately when needed:

```bash
# Inside the API container (ops only)
RUN_MIGRATIONS=1 node ace migration:run --force
# or:
node ace migration:run --force
```

---

## Sécurité (résumé)

| Règle | Détail |
|---|---|
| Pas de secrets dans le repo | Webhook, `APP_KEY`, DB, SMTP, Ally, Tailscale → GitHub Secrets / Dokploy env uniquement |
| Webhook via Tailscale | Le runner GHA rejoint le tailnet puis `POST` l’URL privée ; ne jamais committer l’URL |
| Push GHCR | Auth `GITHUB_TOKEN` (packages write) — pas de PAT dédié si Workflow permissions = Read and write |
| Image runtime | Secrets runtime **hors** image (env Dokploy) ; package **Private** recommandé |
| Logs CI | Ne pas echo l’URL webhook ni le body de réponse |

---

## 1. Secrets GitHub Actions (noms exacts)

Settings → Secrets and variables → Actions.

| Secret | Required | Purpose |
|---|---|---|
| `DOKPLOY_API_DEPLOY_WEBHOOK` | **Oui** | URL complète du webhook deploy Dokploy du service **Application** `api` (Tailscale, ex. `http://100.x.y.z:3000/api/deploy/<token>`). Ne jamais committer. |
| `TS_OAUTH_CLIENT_ID` | Une des options Tailscale | Client OAuth Tailscale (`auth_keys`, tags `tag:ci`) — **API notify** (le site n’utilise plus Tailscale) |
| `TS_OAUTH_SECRET` | Avec OAuth | Secret OAuth — **API notify** |
| `TS_AUTHKEY` | **Ou** à la place d’OAuth | Auth key CI réutilisable + ephemeral + `tag:ci` — **API notify** |

Les secrets Tailscale restent pour l’**API** uniquement. Le site préfère un webhook **HTTPS** public (`DOKPLOY_SITE_DEPLOY_WEBHOOK`) sans join Tailscale — voir [`DOCKER.md`](./DOCKER.md).

`GITHUB_TOKEN` (permissions packages write) suffit pour push GHCR — pas de PAT dédié si Workflow permissions = Read and write.

---

## 2. Créer le service Dokploy `api` (Application Docker)

Projet **À ta soif** → Create Service → **Application** (pas Compose) :

| Field | Value |
|---|---|
| Name | `api` |
| Type | **Application** |
| Provider | **Docker** (pull) |
| Docker image | `ghcr.io/anthonymarcelin/atasoif-api:latest` |
| Port | **3000** |
| Registry | Si package **Private** : registry GHCR Dokploy existant (même que site / Spawnzone). Si **Public** : pull anonyme OK |
| Network | Même réseau Docker que PostGIS Dokploy (voir §3) |
| Domain | `api.atasoif.fr` → HTTPS → port conteneur **3000** |
| Healthcheck (UI) | `GET /health` · path `/health` · port `3000` (l’image a aussi un `HEALTHCHECK` Docker) |

Activer le **Deploy webhook** (onglet Deployments) → copier l’URL complète → secret GitHub `DOKPLOY_API_DEPLOY_WEBHOOK`.

### Webhook Application vs Compose

Le workflow CI est identique pour les deux (`POST` JSON vide `{}` après Tailscale). **Seul le chemin d’URL change** — copier depuis l’UI du service concerné :

| Type Dokploy | Forme typique de l’URL webhook |
|---|---|
| **Application** (cible API) | `…/api/deploy/<token>` |
| **Compose** (à éviter ici) | `…/api/deploy/compose/<token>` |

Si le service a été créé en Compose par erreur : le recréer en **Application Docker**, reconfigurer env + réseau + domaine, puis **mettre à jour** le secret `DOKPLOY_API_DEPLOY_WEBHOOK` (nouveau token).

Préférer l’URL **Tailscale** (`http://100.x.y.z:…`) pour le secret CI, pas l’URL publique Dokploy.

---

## 3. Réseau Postgres (PostGIS déjà créé)

| Field | Value |
|---|---|
| Host interne | `infra-postgis-rfekdz` |
| Port | `5432` |
| Database | `atasoif_v2` |
| User | `atasoif` |
| Password | (secret Dokploy / vault — ne pas committer) |

Le service `api` doit être sur le **même Docker network** Dokploy que le conteneur PostGIS pour résoudre `infra-postgis-rfekdz`.

---

## 4. Variables d’environnement Dokploy (runtime)

Générer `APP_KEY` localement : `cd apps/api && node ace generate:key` (ne jamais committer la valeur).

### Obligatoires

| Variable | Exemple / notes |
|---|---|
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | `3000` |
| `LOG_LEVEL` | `info` |
| `APP_KEY` | secret Adonis (32+ chars) |
| `APP_URL` | `https://api.atasoif.fr` (origine publique HTTPS de l’API) |
| `FRONTEND_URL` | mail / web OAuth return (prod: `https://www.atasoif.fr`). **Never** `https://api.atasoif.fr` |
| `NATIVE_OAUTH_RETURN_URL` | Capacitor Ally return (`fr.atasoif.app://auth/oauth/callback`) when redirect uses `?client=native` |
| `SHARE_LINK_ORIGIN` | Public invite links (default `https://atasoif.fr` → `/i/:code`) |
| `SESSION_DRIVER` | `cookie` |
| `DB_HOST` | `infra-postgis-rfekdz` |
| `DB_PORT` | `5432` |
| `DB_USER` | `atasoif` |
| `DB_PASSWORD` | mot de passe Postgres |
| `DB_DATABASE` | `atasoif_v2` |
| `RUN_MIGRATIONS` | **`0` or omit** (protect live DB). Set `1` only when you intentionally want boot-time Lucid migrate |
| `MAIL_MAILER` | `smtp` |
| `MAIL_FROM_NAME` | `À ta soif` |
| `MAIL_FROM_ADDRESS` | adresse réelle (ex. `hello@atasoif.fr`) |
| `SMTP_HOST` | hôte SMTP prod (pas Mailpit) |
| `SMTP_PORT` | ex. `587` |
| `OFF_API_BASE_URL` | `https://world.openfoodfacts.org` |
| `OFF_USER_AGENT` | `Atasoif/0.1 (hello@atasoif.fr)` |
| `UPCITEMDB_ENABLED` | `true` |
| `UPCITEMDB_API_BASE_URL` | `https://api.upcitemdb.com/prod/trial` |

### Fortement recommandés

| Variable | Notes |
|---|---|
| `CORS_ORIGIN` | CSV — marketing + Capacitor WebView: `https://www.atasoif.fr,https://atasoif.fr,capacitor://localhost,https://localhost` (add a hosted cave origin later if needed — [`DOKPLOY-WEB.md`](./DOKPLOY-WEB.md)) |
| `OPS_ADMIN_TOKEN` | long secret aléatoire pour `GET /api/v1/ops/kpis` (`X-Ops-Token`). Vide = route fermée |
| `STORE_REVIEW_SECRET` | secret App Store / TestFlight pour `POST /api/v1/auth/store-review`. Même valeur dans les notes de soumission. **Jamais** dans le build web / Capacitor. Vide = refus |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | si le SMTP le demande |
| `CELLAR_PHOTO_DIR` | chemin absolu volume persistant (photos cave) hors release |

### Ally (optionnels au boot ; requis pour login social)

| Variable | Notes |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | redirect `{APP_URL}/api/v1/auth/google/callback` |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | redirect `{APP_URL}/api/v1/auth/facebook/callback` |
| `APPLE_CLIENT_ID` | Services ID web (`com.atasoif.web`) — Return URL `{APP_URL}/api/v1/auth/apple/callback` |
| `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | Team + Key ID + PEM `.p8` — JWT client secret signed at runtime (leave `APPLE_CLIENT_SECRET` empty) |
| `APPLE_CLIENT_SECRET` | Legacy static JWT — unused when TEAM/KEY/PEM are set |
| `APPLE_BUNDLE_ID` | iOS bundle (`fr.atasoif.app`) — documentation / future native SIWA |

#### Sign in with Apple (TestFlight) — Anthony checklist

1. **Dokploy API env**
   - `APP_URL=https://api.atasoif.fr`
   - `FRONTEND_URL=https://www.atasoif.fr` (not the API host)
   - `NATIVE_OAUTH_RETURN_URL=fr.atasoif.app://auth/oauth/callback`
   - `SHARE_LINK_ORIGIN=https://atasoif.fr` (optional; this is the default)
   - Apple keys as above (`APPLE_CLIENT_ID=com.atasoif.web`, Team / Key / PEM)
2. **Apple Developer → Identifiers → Services ID `com.atasoif.web`**
   - Sign in with Apple enabled
   - Domains: `api.atasoif.fr`
   - Return URLs: `https://api.atasoif.fr/api/v1/auth/apple/callback` (exact)
3. **Apple Developer → Keys** — Sign in with Apple key linked to the App ID `fr.atasoif.app` + Services ID
4. Redeploy API after env change; ship a new TestFlight build that includes `OAuthSessionPlugin` + URL scheme `fr.atasoif.app`

### Optionnels catalogue / ops

`UPCITEMDB_USER_KEY`, `UPCITEMDB_KEY_TYPE`, `CATALOG_NURSE_DAILY_LIMIT`, `CELLAR_PHOTO_MAX_BYTES`.

| Variable | Notes |
|---|---|
| `CATALOG_IMAGE_STORAGE_PATH` | Absolute path for OFF front mirrors, e.g. `/var/lib/atasoif/catalog-images`. Mount a **persistent** volume here before `catalog:mirror-images`. Host dir ownership must match the container user (`USER atasoif`) or Ace fails with `EACCES`. |
| `CATALOG_IMAGE_PUBLIC_BASE_URL` | Optional. Empty → `/api/v1/media/off` (served by API, auth required). |

See [`CATALOG-SEED.md`](./CATALOG-SEED.md) § Image mirror / § 4b.

---

## 5. Domaine + TLS

1. Domaine **`api.atasoif.fr`** → VPS / Dokploy.
2. HTTPS Let’s Encrypt (même pattern que le site).
3. Proxy → conteneur port **3000**.
4. `APP_URL` = `https://api.atasoif.fr` (Ally + mails).

---

## 6. Tags image (GHCR)

Sur chaque run réussi depuis `main` :

| Tag | Usage |
|---|---|
| `latest` | Tag que Dokploy Application pinne pour le pull simple |
| `sha-<short>` | Pin immutable (ex. `sha-a1b2c3d`) pour audit / rollback manuel |

Rollback : dans Dokploy, pointer temporairement l’image vers `ghcr.io/anthonymarcelin/atasoif-api:sha-<short>` puis redéployer ; ou re-tagger / re-run depuis un commit connu.

---

## 7. Après le premier push GHCR (checklist Anthony)

1. Recréer le service `api` en **Application Docker** si c’était un Compose (sinon webhook `/api/deploy/compose/…` ≠ Application).
2. Configurer image `…/atasoif-api:latest`, réseau PostGIS, env §4, domaine `api.atasoif.fr`.
3. Créer / recopier le webhook deploy **Application** → secret GitHub `DOKPLOY_API_DEPLOY_WEBHOOK` (URL Tailscale).
4. Repo → Settings → Actions → General → Workflow permissions → **Read and write**.
5. Package **`atasoif-api`** → lié à `AnthonyMarcelin/atasoif-v2`. Visibilité : **Private** recommandé. Si Private → registry GHCR Dokploy existant.
6. **Accord explicite** puis merger `dev` → **`main`** (ou `workflow_dispatch` sur le workflow API) pour déclencher **API GHCR**.
7. Smoke : `curl -s https://api.atasoif.fr/health` → `database":"up"`.
8. **Ensuite seulement** : seed catalogue / `migrate:v1` (hors de ce doc).

**Catalogue OFF dump (volume):** once the API is healthy, follow the **Prod / Dokploy runbook** in [`CATALOG-SEED.md`](./CATALOG-SEED.md) — host DuckDB filter → dry-run Ace `catalog:off-dump` in the API container → persist. Independent of `RUN_MIGRATIONS`. Do **not** wipe the DB.

---

## 8. Flux auto-deploy

1. Merge feature → `dev` (CI vert) → plus tard merge `dev` → **`main`** (accord explicite).
2. Actions **API GHCR** : build → push `…/atasoif-api:latest` + `…/atasoif-api:sha-<short>`.
3. Job **Notify Dokploy (Tailscale)** : `POST` `DOKPLOY_API_DEPLOY_WEBHOOK` (body `{}`).
4. Dokploy pull `latest` + restart · entrypoint boot (migrate only if `RUN_MIGRATIONS=1`) + Adonis.
5. Vérifier `/health`.

`continue-on-error: false` — webhook / Tailscale en échec = workflow rouge.

---

## 9. Build local (debug)

```bash
# Context = racine monorepo
docker build -f Dockerfile --target production -t atasoif-api .
docker run --rm -p 3000:3000 --env-file apps/api/.env atasoif-api
curl -s http://localhost:3000/health
```

Voir aussi [`docs/DOCKER.md`](./DOCKER.md) (Compose local + lien vers ce doc).
