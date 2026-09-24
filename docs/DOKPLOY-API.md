# Dokploy — API Adonis (`atasoif-api`) · GHCR

Déploiement **production** de l’API via image prébuildée GHCR + webhook Dokploy (même modèle que le site).

| Item | Value |
|---|---|
| Image | **`ghcr.io/anthonymarcelin/atasoif-api`** |
| Dockerfile | `Dockerfile` (racine, target `production`, context `.`) |
| Entrypoint | `apps/api/docker-entrypoint.sh` → `migration:run --force` puis `node bin/server.js` |
| Tags | `latest` sur pushes **`main`** · aussi short/long `sha-*` |
| Workflow | [`.github/workflows/api-ghcr.yml`](../.github/workflows/api-ghcr.yml) |
| Trigger | **`push` / merge sur `main`** (path filters API / shared / Docker) + `workflow_dispatch` |
| Dokploy provider | **Docker** (pull) — **pas** Nixpacks, **pas** build git |

## Branch trigger — `main` (prod), pas `dev`

| App | Workflow | Branch qui déploie |
|---|---|---|
| **API** (ce doc) | `api-ghcr.yml` | **`main`** |
| Site (landing) | `site-ghcr.yml` | actuellement **`dev`** (voir [`docs/DOCKER.md`](./DOCKER.md)) |

Préférence projet historique : merge → **`main`** = prod. L’API est alignée là-dessus.  
Un merge PR → `dev` **ne déploie pas** l’API. Pour pousser une image + webhook Dokploy : merger `dev` → `main` (ou lancer **workflow_dispatch** sur `api-ghcr.yml` depuis `main`).

Ne lance **pas** `migrate:v1` depuis cet entrypoint — migration v1 = commande Ace one-shot **après** service up + seed catégories.

---

## 1. Secrets GitHub Actions (noms exacts)

Settings → Secrets and variables → Actions.

| Secret | Required | Purpose |
|---|---|---|
| `DOKPLOY_API_DEPLOY_WEBHOOK` | **Oui** (nouveau) | URL complète du webhook deploy Dokploy du service `api` (Tailscale, ex. `http://100.x.y.z:3000/api/deploy/...`). Ne jamais committer. |
| `TS_OAUTH_CLIENT_ID` | Une des options Tailscale | Client OAuth Tailscale (`auth_keys`, tags `tag:ci`) — **déjà** utilisé pour le site |
| `TS_OAUTH_SECRET` | Avec OAuth | Secret OAuth — **déjà** utilisé pour le site |
| `TS_AUTHKEY` | **Ou** à la place d’OAuth | Auth key CI réutilisable + ephemeral + `tag:ci` — **déjà** utilisé pour le site |

Réutiliser les secrets Tailscale du site. Seul secret **nouveau** typiquement : `DOKPLOY_API_DEPLOY_WEBHOOK`.

`GITHUB_TOKEN` (permissions packages write) suffit pour push GHCR — pas de PAT dédié si Workflow permissions = Read and write.

---

## 2. Créer le service Dokploy `api`

Projet **À ta soif** (pas Spawnzone) → Create Service / Application :

| Field | Value |
|---|---|
| Name | `api` |
| Provider | **Docker** (pull) |
| Docker image | `ghcr.io/anthonymarcelin/atasoif-api:latest` |
| Port | **3000** |
| Registry | Si package **Private** : registry GHCR Dokploy existant (même que Spawnzone / site). Si **Public** : pull anonyme OK |
| Network | Même réseau Docker que PostGIS Dokploy (voir §3) |
| Healthcheck (UI) | `GET /health` · path `/health` · port `3000` (l’image a aussi un `HEALTHCHECK` Docker) |

Activer le **Deploy webhook** Dokploy → copier l’URL complète → secret GitHub `DOKPLOY_API_DEPLOY_WEBHOOK`.

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
| `FRONTEND_URL` | origine Angular / deep links mail (ex. `https://app.atasoif.fr` ou URL Capacitor) |
| `SESSION_DRIVER` | `cookie` |
| `DB_HOST` | `infra-postgis-rfekdz` |
| `DB_PORT` | `5432` |
| `DB_USER` | `atasoif` |
| `DB_PASSWORD` | mot de passe Postgres |
| `DB_DATABASE` | `atasoif_v2` |
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
| `CORS_ORIGIN` | origines front autorisées (CSV) |
| `OPS_ADMIN_TOKEN` | long secret aléatoire pour `GET /api/v1/ops/kpis` (`X-Ops-Token`). Vide = route fermée |
| `SMTP_USERNAME` / `SMTP_PASSWORD` | si le SMTP le demande |
| `CELLAR_PHOTO_DIR` | chemin absolu volume persistant (photos cave) hors release |

### Ally (optionnels au boot ; requis pour login social)

| Variable | Notes |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | redirect `{APP_URL}/api/v1/auth/google/callback` |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | redirect `{APP_URL}/api/v1/auth/facebook/callback` |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` | Sign in with Apple (requis si social iOS) |

### Optionnels catalogue / ops

`UPCITEMDB_USER_KEY`, `UPCITEMDB_KEY_TYPE`, `CATALOG_NURSE_DAILY_LIMIT`, `CATALOG_IMAGE_STORAGE_PATH`, `CATALOG_IMAGE_PUBLIC_BASE_URL`, `CELLAR_PHOTO_MAX_BYTES`.

---

## 5. Domaine + TLS

1. Domaine API (ex. `api.atasoif.fr`) → VPS / Dokploy.
2. HTTPS Let’s Encrypt (même pattern que le site).
3. Proxy → conteneur port **3000**.
4. `APP_URL` = URL HTTPS canonique (Ally + mails).

---

## 6. Après le premier push GHCR (checklist Anthony)

1. Merger vers **`main`** (ou `workflow_dispatch` sur le workflow API) pour déclencher **API GHCR**.
2. Repo → Settings → Actions → General → Workflow permissions → **Read and write**.
3. Package **`atasoif-api`** → lié à `AnthonyMarcelin/atasoif-v2`. Visibilité : **Private** recommandé (secrets runtime hors image, mais image = code + deps). Si Private → registry GHCR Dokploy existant.
4. Dokploy → service `api` → image `…/atasoif-api:latest` → réseau PostGIS → env §4 → Deploy.
5. Créer le webhook deploy → secret `DOKPLOY_API_DEPLOY_WEBHOOK`.
6. Smoke : `curl -s https://api.atasoif.fr/health` → `database":"up"`.
7. **Ensuite seulement** : seed catalogue / `migrate:v1` (hors de ce doc).

---

## 7. Flux auto-deploy

1. Merge feature → `dev` (CI vert) → plus tard merge `dev` → **`main`**.
2. Actions **API GHCR** : build → push `ghcr.io/anthonymarcelin/atasoif-api:latest` (+ sha).
3. Job **Notify Dokploy (Tailscale)** : `POST` `DOKPLOY_API_DEPLOY_WEBHOOK`.
4. Dokploy pull + restart · entrypoint migrate + boot.
5. Vérifier `/health`.

`continue-on-error: false` — webhook / Tailscale en échec = workflow rouge.

---

## 8. Build local (debug)

```bash
# Context = racine monorepo
docker build -f Dockerfile --target production -t atasoif-api .
docker run --rm -p 3000:3000 --env-file apps/api/.env atasoif-api
curl -s http://localhost:3000/health
```

Voir aussi [`docs/DOCKER.md`](./DOCKER.md) (Compose local + lien vers ce doc).
