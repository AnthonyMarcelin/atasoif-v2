# Tickets — E1 Identity & access

Orchestrator backlog for Sprint 1 (+ deferred Apple).  
Each ticket is sized for a **sub-agent thread**. One ticket = one PR into `dev` when possible.

**Epic goal:** users can create an account and stay signed in.

**Prerequisites (block all E1 API work):** Sprint 0 / Adonis bascule closed — Postgres up, Lucid migrate + seed, `GET /health` OK, Ally package installed (Google + Facebook drivers stubbed).

**Stack refs:** AdonisJS 7 **Auth** (access tokens) + **Ally** (Google, Facebook; Apple via custom driver). Official docs via Context7 (`/adonisjs/v7-docs`). Nest / Prisma / Better Auth are archived under `archive/nest-api` — do not reintroduce them.

**Product rules:**
- Client-facing copy: **French** (informal “tu”)
- Code / commits / technical comments: **English**
- Conventional Commits EN, no AI co-author
- Do **not** clone atasoif.fr v1 UI
- Facebook OAuth = **login only** — no Graph import of “all FB friends” (in-app friends remain E6)

---

## Ticket index

| ID | Title | Priority | Sprint | Depends on | Suggested owner |
|---|---|---|---|---|---|
| [E1-T01](#e1-t01--adonis-auth-bootstrap--health) | Adonis Auth bootstrap + `/health` | Must | S1 | S0 / Adonis swap | API |
| [E1-T02](#e1-t02--signup--login--logout--me) | Signup / login / logout / me | Must | S1 | T01 | API |
| [E1-T03](#e1-t03--verify-email--password-reset) | Verify email + password reset | Must | S1 | T02 | API |
| [E1-T04](#e1-t04--auth-ui-shell-angular) | Auth UI shell (Angular) | Must | S1 | T02 | Web |
| [E1-T05](#e1-t05--wire-web--bearer-tokens) | Wire web → Bearer tokens | Must | S1 | T02, T04 | Web |
| [E1-T06](#e1-t06--profile-pseudo--ispublic) | Profile: pseudo + isPublic | Should | S1 | T02, T05 | Full |
| [E1-T07](#e1-t07--ally-google) | Ally Google | Should | S1 | T01, T05 | Full |
| [E1-T08](#e1-t08--ally-facebook) | Ally Facebook | Should | S1 | T01, T05 | Full |
| [E1-T09](#e1-t09--ally-apple) | Ally Apple (stores) | Must (stores) | S5 | T07 or T01 | Full |

**Recommended order:** T01 → T02 → T04 ∥ T03 → T05 → T06 → T07 ∥ T08 · T09 later (S5)

---

## E1-T01 — Adonis Auth bootstrap + `/health`

| | |
|---|---|
| **Type** | chore / feat |
| **Priority** | Must |
| **Area** | `apps/api` |
| **Depends on** | Adonis swap + Lucid domain |
| **Blocks** | T02–T03, T07–T09 |

### Goal
Confirm Adonis Auth (access tokens guard) is wired, env documented, CORS ready, and ops contract `GET /health` stays green.

### Acceptance criteria
- [ ] `@adonisjs/auth` access tokens guard usable (kit routes under `/api/v1/auth/*` + `/api/v1/account/*` or equivalent)
- [ ] `users` + `auth_access_tokens` (or kit tables) migrated via Lucid
- [ ] `.env.example` documents `APP_KEY`, `DB_*`, `CORS_ORIGIN`, Ally placeholders
- [ ] CORS allows `apps/web` origin
- [ ] `GET /health` returns DB ping + `status: ok` when Postgres is up
- [ ] Short note in README / `docs/STACK-ADONIS.md`: how to run auth locally (Node ≥ 24)

### Out of scope
- Login/register UI
- Full OAuth flows
- Email sending

### Tech notes
- Use Context7 Adonis Auth docs — do not invent token APIs from memory.
- Nest/Better Auth must not be restored.

### Suggested commit
`feat: bootstrap Adonis Auth and health check`

---

## E1-T02 — Signup / login / logout / me

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/api` |
| **Depends on** | T01 |
| **Blocks** | T03–T06 |

### Goal
Email/password signup, login (issue access token), logout (revoke token), and authenticated “me/profile”.

### Acceptance criteria
- [ ] `POST` signup creates user + returns token (or login step)
- [ ] `POST` login validates credentials + returns Bearer access token
- [ ] `POST` logout revokes current token when authenticated
- [ ] `GET` me/profile returns current user (id, email, pseudo, isPublic, …)
- [ ] Invalid credentials → 401 with clear JSON error
- [ ] Password hashed via Adonis hash (never stored plaintext)
- [ ] API tests cover happy path + bad password

### Out of scope
- Email verification UI
- Social OAuth
- Angular forms (T04)

### Suggested commit
`feat: add email password auth endpoints`

---

## E1-T03 — Verify email + password reset

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/api` |
| **Depends on** | T02 |

### Goal
Email verification + forgot/reset password using Adonis patterns (tokens / signed URLs + mailer).

### Acceptance criteria
- [ ] Verification flow configured (mail transport can be ethereal/log in dev)
- [ ] Unverified users handled per product rule (block sensitive actions or soft-warn — document choice)
- [ ] Forgot password + reset endpoints work end-to-end in tests
- [ ] FR copy for email templates (informal “tu”)
- [ ] Env vars for SMTP / mail documented in `.env.example`

### Out of scope
- Changing mail provider in prod (can stay log driver until E0.7)

### Suggested commit
`feat: add email verification and password reset`

---

## E1-T04 — Auth UI shell (Angular)

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/web` |
| **Depends on** | T02 (API contract known) |

### Goal
French auth screens: signup, login, logout entry, basic empty states — no v1 clone.

### Acceptance criteria
- [ ] Routes for login / signup (and stubs for forgot password)
- [ ] Forms validate client-side (email + password rules)
- [ ] Copy in French (“tu”)
- [ ] Accessible labels / focus states
- [ ] Design follows `docs/DESIGN.md` (no generic purple dashboard look)

### Out of scope
- Wiring real API (T05)
- Social buttons until T07/T08

### Suggested commit
`feat: add Angular auth UI shell`

---

## E1-T05 — Wire web → Bearer tokens

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/web` (+ thin API tweaks if needed) |
| **Depends on** | T02, T04 |

### Goal
Angular calls Adonis auth with `Authorization: Bearer <token>`, persists token securely enough for web MVP, guards routes.

### Acceptance criteria
- [ ] Auth service stores access token (memory + secure storage strategy documented)
- [ ] HTTP interceptor attaches Bearer token
- [ ] 401 clears session and redirects to login
- [ ] Route guards protect cellar routes
- [ ] Login/signup forms call real API successfully against local Adonis

### Out of scope
- Refresh-token rotation sophistication beyond Adonis defaults
- Capacitor secure storage (later mobile epic)

### Suggested commit
`feat: wire Angular client to Adonis Bearer auth`

---

## E1-T06 — Profile: pseudo + isPublic

| | |
|---|---|
| **Type** | feat |
| **Priority** | Should |
| **Area** | `apps/api` + `apps/web` |
| **Depends on** | T02, T05 |

### Goal
User can set display pseudo and public/private visibility (`isPublic`).

### Acceptance criteria
- [ ] Lucid `users.pseudo` + `users.is_public` (already migrated) exposed via update endpoint
- [ ] Validation: pseudo uniqueness / length rules documented
- [ ] Angular profile form updates and reflects values
- [ ] FR UI copy

### Out of scope
- Public profile pages / social graph (E6)

### Suggested commit
`feat: add user pseudo and visibility profile fields`

---

## E1-T07 — Ally Google

| | |
|---|---|
| **Type** | feat |
| **Priority** | Should |
| **Area** | `apps/api` (+ web button) |
| **Depends on** | T01, T05 |

### Goal
Google OAuth login via `@adonisjs/ally` → issue Adonis access token.

### Acceptance criteria
- [ ] Redirect + callback routes for Google
- [ ] Env `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` documented and used
- [ ] First login creates user; subsequent login links same email/account
- [ ] Returns same Bearer token shape as email login
- [ ] Angular “Continuer avec Google” button
- [ ] No dependency on Better Auth

### Out of scope
- Calendar/Drive scopes — email/profile only

### Suggested commit
`feat: add Google OAuth via Ally`

---

## E1-T08 — Ally Facebook

| | |
|---|---|
| **Type** | feat |
| **Priority** | Should |
| **Area** | `apps/api` (+ web button) |
| **Depends on** | T01, T05 |

### Goal
Facebook OAuth **login** via Ally (accelerator). Friends stay in-app (E6) — do **not** import Graph “all friends”.

### Acceptance criteria
- [ ] Redirect + callback for Facebook
- [ ] Env `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET`
- [ ] Login creates/links user + issues Bearer token
- [ ] Angular “Continuer avec Facebook”
- [ ] Explicitly no friends-list sync

### Out of scope
- Meta friends graph / social import

### Suggested commit
`feat: add Facebook OAuth via Ally`

---

## E1-T09 — Ally Apple (stores)

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must (App Store / Play when shipping native) |
| **Sprint** | **S5** (deferred) |
| **Area** | `apps/api` + Capacitor |
| **Depends on** | T01 (and preferably T07 pattern) |

### Goal
Sign in with Apple for store compliance. Ally **does not ship an Apple driver** — implement a **custom Ally driver** (or approved community package) using Apple’s OAuth/OIDC.

### Acceptance criteria
- [ ] Custom Apple Ally driver registered alongside Google/Facebook
- [ ] Env for Apple client id / secret (JWT client secret as required by Apple)
- [ ] Web + native Capacitor flows documented
- [ ] Issues same Bearer token as other providers
- [ ] Store guideline checklist noted in ticket PR

### Out of scope
- Shipping to stores in S1

### Suggested commit
`feat: add Apple Sign In via custom Ally driver`

---

## Orchestrator notes

Follow `.cursor/rules` (EN code/docs, FR UI). Use Context7 for Adonis Auth / Ally / Lucid. Prefer smallest PR per ticket. Archive Nest tree is reference-only for data-model migration.
