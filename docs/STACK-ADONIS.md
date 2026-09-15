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
# GET  /api/v1/account/profile        (Authorization: Bearer <token>)
# POST /api/v1/account/logout         (Authorization: Bearer <token>)
# POST /api/v1/account/email/resend   (Authorization: Bearer <token>)
```

Signup/login responses wrap `{ type: "bearer", token, user }` under `data`. Passwords are hashed with Adonis scrypt via the AuthFinder mixin — never stored plaintext. Invalid login credentials return **401** JSON (`E_INVALID_CREDENTIALS`).

### Email verification + password reset (E1-T03)

- Mail via `@adonisjs/mail` SMTP. **Local/dev:** [Mailpit](https://mailpit.axllent.org/) catches SMTP on `:1025`, UI on `http://localhost:8025` (started with `bun run docker:dev`).
- Point `SMTP_HOST` / `SMTP_PORT` at Mailpit (`localhost:1025` on host, `mailpit:1025` in Compose). Leave `SMTP_USERNAME` / `SMTP_PASSWORD` empty for Mailpit.
- Templates use Nuit tokens (dark cellar + amber `#E39A3C`, radius 0) with FR tutoiement; deep links use `FRONTEND_URL`.
- Tokens are purpose-bound Adonis encryption (`email-verification` 48h, `password-reset` 1h).

**Unverified users (product rule):** soft-warn only. Signup/login and cellar actions stay allowed; `emailVerified: false` is exposed on profile so the client can nudge. Hard gates (billing, social share, etc.) can layer later — do not block the cave memory JTBD on mail delivery in early environments.

**Rate limiting:** not wired yet (no `@adonisjs/limiter` in the kit). Protect `POST /api/v1/auth/login`, `POST /api/v1/auth/signup`, and password-reset endpoints before production traffic — e.g. Adonis Limiter or reverse-proxy limits.

Set `CORS_ORIGIN=http://localhost:4200` so `apps/web` can call the API. Ally placeholders (`GOOGLE_*`, `FACEBOOK_*`, `APPLE_*`) stay unused until E1-T07+.

### Angular Bearer client (E1-T05)

`apps/web` talks to Adonis with `Authorization: Bearer <token>`:

1. `AuthService` keeps the token in memory (signals) and persists it in `localStorage` (`atasoif.auth.access_token`) for web MVP refreshes.
2. Functional `authInterceptor` attaches the header to API calls and, on **401** (except login/signup/forgot/reset), clears the session and redirects to `/auth/login`.
3. `authGuard` protects `/me` and `/cellar` (future collection surface).
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
