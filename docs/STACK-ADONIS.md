# Stack decision — AdonisJS backend

**Decision (2026-08):** replace NestJS + Prisma + Better Auth with **AdonisJS + Lucid + Auth + Ally**.

## Why

- Full MVC framework (Laravel-like) in TypeScript — better solo velocity than assembling Nest modules
- Batteries included: Lucid ORM, validators, mail, auth, migrations
- **Ally** = official social OAuth (Google, Apple, **Facebook**, GitHub, …)
- Angular/Capacitor front stays; API remains JSON

## Auth plan

| Method | Package | Notes |
|---|---|---|
| Email + password | `@adonisjs/auth` | Official |
| Google / Facebook | `@adonisjs/ally` | Built-in drivers |
| Apple | Custom Ally driver | Ally has no Apple driver yet — see E1-T09 |
| API / mobile | Access tokens (opaque) | Capacitor-friendly |

### Facebook + “amis”

- **Login with Facebook** via Ally = yes, first-class.
- **Import Facebook friends graph** = limited: Meta mostly allows friends who also use the app and granted permission (App Review). Do not rely on a full FB friend list.
- Practical social path for Atasoif: Ally login → match users by email/pseudo → in-app friend requests (E6). Facebook is an **auth accelerator**, not the friends database.

## Version

- **AdonisJS v7** API kit on **Node ≥ 24** (local Herd/nvm + Docker `node:24-alpine`).
- **Bun** is the monorepo package manager; Ace and the API process still run on Node (see [`docs/BUN.md`](./BUN.md)).

## Local auth (Adonis access tokens)

Requires **Bun** (install) + **Node ≥ 24** (Ace / server). Auth uses the `api` access-tokens guard (`Authorization: Bearer <token>`).

```bash
# 1. Env
cp apps/api/.env.example apps/api/.env
cd apps/api && node ace generate:key   # writes APP_KEY

# 2. Postgres up (Docker host :5432 or local), then:
bun install
bun run db:migrate
bun run db:seed

# 3. Run API (Node under the hood)
bun run dev:api   # http://localhost:3000

# Ops contract
curl -s http://localhost:3000/health
# → {"status":"ok","database":"up",…}

# Auth routes (E1-T02 + E1-T03)
# POST /api/v1/auth/signup            { email, password, passwordConfirmation, fullName?, pseudo? }
# POST /api/v1/auth/login             { email, password }
# POST /api/v1/auth/email/verify      { token }
# POST /api/v1/auth/forgot-password   { email }
# POST /api/v1/auth/reset-password    { token, password, passwordConfirmation }
# GET   /api/v1/account/profile       (Authorization: Bearer <token>)
# PATCH /api/v1/account/profile       { pseudo, isPublic } (Bearer)
# POST  /api/v1/account/logout        (Authorization: Bearer <token>)
# POST  /api/v1/account/email/resend  (Authorization: Bearer <token>)
```

Signup/login responses wrap `{ type: "bearer", token, user }` under `data`. Passwords are hashed with Adonis scrypt via the AuthFinder mixin — never stored plaintext. Invalid login credentials return **401** JSON (`E_INVALID_CREDENTIALS`).

### Profile fields (E1-T06)

- `PATCH /api/v1/account/profile` updates `pseudo` + `isPublic` for the authenticated user.
- **Pseudo:** required on update, 2-32 chars, charset `[a-zA-Z0-9._-]`, unique (current user excluded). Optional at signup; DB column remains nullable.
- **isPublic:** boolean; default `false` at signup. Reserved for future social discoverability (E6) — no public profile pages yet.

### Email verification + password reset (E1-T03)

- Mail via `@adonisjs/mail` SMTP. **Local/dev:** [Mailpit](https://mailpit.axllent.org/) catches SMTP on `:1025`, UI on `http://localhost:8025` (started with `bun run docker:dev`).
- Point `SMTP_HOST` / `SMTP_PORT` at Mailpit (`localhost:1025` on host, `mailpit:1025` in Compose). Leave `SMTP_USERNAME` / `SMTP_PASSWORD` empty for Mailpit.
- Templates use Nuit tokens (dark cellar + amber `#E39A3C`, radius 0) with FR tutoiement; deep links use `FRONTEND_URL`.
- Tokens are purpose-bound Adonis encryption (`email-verification` 48h, `password-reset` 1h).

**Unverified users (product rule):** hard gate on app usage. Signup/login still issue a Bearer token so the client can reach the verify screen and resend mail, but protected app actions (profile update, future cellar routes, etc.) return **403** `E_EMAIL_UNVERIFIED` until `emailVerified` is true. `GET /api/v1/account/profile`, logout, and email resend stay available while unverified.


**Rate limiting:** not wired yet (no `@adonisjs/limiter` in the kit). Protect `POST /api/v1/auth/login`, `POST /api/v1/auth/signup`, and password-reset endpoints before production traffic — e.g. Adonis Limiter or reverse-proxy limits.

Set `CORS_ORIGIN=http://localhost:4200` so `apps/web` can call the API.

### Google OAuth via Ally (E1-T07)

```bash
# Google Cloud Console → OAuth client (Web)
# Authorized redirect URI must match exactly:
#   {APP_URL}/api/v1/auth/google/callback
# e.g. http://localhost:3000/api/v1/auth/google/callback
# (Same path shape as Spawnzone Adonis on Dokploy.)

# apps/api/.env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:4200
```

Flow:

1. Angular « Continuer avec Google » → `GET /api/v1/auth/google/redirect`
2. Ally redirects to Google (scopes: openid / userinfo.email / userinfo.profile only)
3. Google → `GET /api/v1/auth/google/callback` on the API
4. Find-or-create user by email (same address links to an existing password account)
5. Issue Bearer access token → redirect to `{FRONTEND_URL}/auth/oauth/callback?token=…`
6. SPA stores the token and calls `/api/v1/account/profile`

Google-verified emails set `emailVerified: true` so the hard-gate does not block social users.

### Facebook OAuth via Ally (E1-T08)

```bash
# Meta Developer → Facebook Login; Valid OAuth Redirect URI:
#   {APP_URL}/api/v1/auth/facebook/callback
# e.g. http://localhost:3000/api/v1/auth/facebook/callback

FACEBOOK_CLIENT_ID=...
FACEBOOK_CLIENT_SECRET=...
```

Same handoff as Google (`/auth/oauth/callback?token=…`). Scopes: `email` + `public_profile` only.  
**No** `user_friends` / Graph friends import — in-app friends remain E6.

Apple stays deferred until E1-T09.

### Angular Bearer client (E1-T05)

`apps/web` talks to Adonis with `Authorization: Bearer <token>`:

1. `AuthService` keeps the token in memory (signals) and persists it in `localStorage` (`atasoif.auth.access_token`) for web MVP refreshes.
2. Functional `authInterceptor` attaches the header to API calls and, on **401** (except login/signup/forgot/reset), clears the session and redirects to `/auth/login`.
3. `authGuard` + `emailVerifiedGuard` protect `/me` and `/cellar`. Unverified sessions land on `/auth/verify-email` (resend + deep-link confirm).
4. API base URL: `environment.apiBaseUrl` (dev default `http://localhost:3000`).

**Storage note:** `localStorage` is XSS-readable. Acceptable for web MVP; Capacitor Secure Storage is planned for native builds (E5). Never log the raw token. Do not store passwords.

## What we drop

- NestJS (archived under `archive/nest-api`)
- Prisma / Better Auth
- Better Auth–era E1 tickets (rewritten for Auth + Ally)

## What we keep

- `apps/web` (Angular)
- `packages/shared`
- Postgres + Docker Compose topology
- Product docs, JTBD, epics (backend tech notes updated)
