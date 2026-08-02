# Tickets — E1 Identity & access

Orchestrator backlog for Sprint 1 (+ deferred Apple).  
Each ticket is sized for a **sub-agent thread**. One ticket = one PR into `dev` when possible.

**Epic goal:** users can create an account and stay signed in.

**Prerequisites (block all E1 API work):** Sprint 0 closed — Postgres up, migrate + seed, `PrismaModule` wired, `GET /health` OK.

**Stack refs:** Better Auth + Nest + Prisma (official docs via Context7). Schema already has `User` / `Session` / `Account` / `Verification`.

**Product rules:**
- Client-facing copy: **French** (informal “tu”)
- Code / commits / technical comments: **English**
- Conventional Commits EN, no AI co-author
- Do **not** clone atasoif.fr v1 UI

---

## Ticket index

| ID | Title | Priority | Sprint | Depends on | Suggested owner |
|---|---|---|---|---|---|
| [E1-T01](#e1-t01--better-auth-nest-bootstrap) | Better Auth Nest bootstrap | Must | S1 | S0 | API |
| [E1-T02](#e1-t02--email--password-auth-api) | Email + password auth API | Must | S1 | T01 | API |
| [E1-T03](#e1-t03--session-guard--me) | Session guard + `/me` | Must | S1 | T02 | API |
| [E1-T04](#e1-t04--email-verification--password-reset) | Email verification + password reset | Must | S1 | T02 | API |
| [E1-T05](#e1-t05--auth-ui-shell-angular) | Auth UI shell (Angular) | Must | S1 | T02 | Web |
| [E1-T06](#e1-t06--wire-web-to-auth-api) | Wire web to auth API + guards | Must | S1 | T03, T05 | Web |
| [E1-T07](#e1-t07--profile-pseudo--visibility) | Profile: pseudo + visibility | Should | S1 | T03, T06 | Full |
| [E1-T08](#e1-t08--google-oauth) | Google OAuth | Should | S1 | T01, T06 | Full |
| [E1-T09](#e1-t09--apple-sign-in) | Apple Sign In | Must (stores) | S5 | T08 or T01 | Full |

**Recommended order:** T01 → T02 → T03 → T05 ∥ T04 → T06 → T07 → T08 · T09 later

---

## E1-T01 — Better Auth Nest bootstrap

| | |
|---|---|
| **Type** | chore / feat |
| **Priority** | Must |
| **Area** | `apps/api` |
| **Depends on** | S0 complete |
| **Blocks** | T02–T04, T08 |

### Goal
Install and configure Better Auth on Nest with Prisma adapter, env vars, and HTTP mount point.

### Acceptance criteria
- [ ] Dependencies added (`better-auth`, Prisma adapter as required by current docs)
- [ ] Auth instance config lives in a dedicated module (e.g. `apps/api/src/auth/`)
- [ ] Auth routes mounted (e.g. `/api/auth/*`) without breaking `/health`
- [ ] `.env.example` documents `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, `CORS_ORIGIN`
- [ ] CORS allows credentials from `apps/web` origin
- [ ] Prisma `User` / `Session` / `Account` / `Verification` models match Better Auth expectations (adjust schema + migrate if docs require it)
- [ ] Short note in `docs/` or README: how to run auth locally

### Out of scope
- Login/register UI
- Google / Apple providers
- Email sending

### Tech notes
- Use Context7 / official Better Auth Nest + Prisma docs — do not invent adapter wiring from memory.
- Align field names with existing schema; migrate rather than duplicate user tables.
- Keep secrets out of git.

### Suggested commit
`feat: bootstrap Better Auth on Nest API`

---

## E1-T02 — Email + password auth API

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/api` |
| **Depends on** | T01 |
| **Blocks** | T03–T06 |

### Goal
Enable sign-up, sign-in, sign-out with email/password via Better Auth.

### Acceptance criteria
- [ ] Sign-up with email + password creates user + credential account
- [ ] Sign-in returns session (cookie or documented token strategy)
- [ ] Sign-out invalidates session
- [ ] Basic validation errors return safe, actionable messages (EN for API internals OK; map to FR on UI later)
- [ ] Unit or e2e smoke tests for register + login happy path (at least one automated check)
- [ ] Password never logged or returned in JSON

### Out of scope
- Verification email (T04)
- OAuth (T08/T09)
- Angular screens (T05)

### Suggested commit
`feat: enable email password auth endpoints`

---

## E1-T03 — Session guard + `/me`

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/api` |
| **Depends on** | T02 |
| **Blocks** | T06, T07, all future protected cellar APIs |

### Goal
Protect API routes and expose current user.

### Acceptance criteria
- [ ] `GET /me` (or `/api/me`) returns `{ id, email, name, pseudo, … }` for authenticated session
- [ ] Unauthenticated → `401`
- [ ] Nest guard/middleware reusable for future modules
- [ ] At least one protected dummy or real route demonstrates the guard
- [ ] Test: 401 without session, 200 with session

### Out of scope
- Profile update (T07)
- Role/admin ACL (later)

### Suggested commit
`feat: add session guard and me endpoint`

---

## E1-T04 — Email verification + password reset

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/api` (+ mailer util) |
| **Depends on** | T02 |
| **Blocks** | Production hardening (can ship S1 with documented dev bypass) |

### Goal
Verify email on register; allow forgot/reset password.

### Acceptance criteria
- [ ] Verification flow configured (Better Auth + mail transport)
- [ ] Forgot-password + reset-password flows work end-to-end in local/dev
- [ ] Tokens expire; reuse of spent token fails
- [ ] Dev mode: documented bypass or Ethereal/Mailpit/Mailhog — **no secrets in repo**
- [ ] Email templates minimal, French client-facing subject/body
- [ ] `.env.example` lists SMTP (or provider) vars without values

### Out of scope
- Fancy HTML marketing templates
- Changing email on profile (later)

### Suggested commit
`feat: add email verification and password reset`

---

## E1-T05 — Auth UI shell (Angular)

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/web` |
| **Depends on** | Design tokens exist; can start in parallel after T02 API contract known |
| **Blocks** | T06 |

### Goal
Minimal FR auth screens — not a clone of atasoif.fr.

### Screens
- Login
- Register
- Forgot password
- Reset password (token from query)
- Email verified / pending state (simple)

### Acceptance criteria
- [ ] Routes exist under e.g. `/login`, `/register`, `/forgot-password`, `/reset-password`
- [ ] Dark cellar / amber tokens used (`_tokens.scss`)
- [ ] Copy French, informal “tu”, short
- [ ] Forms accessible: labels, errors, keyboard
- [ ] Mobile-first layout
- [ ] Loading + error states present (can be wired to fake/local until T06)

### Out of scope
- Google/Apple buttons (T08/T09)
- Full profile page polish (T07)
- Capacitor

### Suggested commit
`feat: add auth screens shell`

---

## E1-T06 — Wire web to auth API + guards

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must |
| **Area** | `apps/web` (+ minor API CORS if needed) |
| **Depends on** | T03, T05 |
| **Blocks** | T07, T08 UI, Sprint 2 UI |

### Goal
Real auth loop in the browser: register → (verify) → login → session → logout; route guards.

### Acceptance criteria
- [ ] Auth service calls Better Auth / API with credentials (cookies)
- [ ] After login, user lands on a simple authenticated home/shell
- [ ] Auth guard redirects anonymous users to `/login`
- [ ] Guest guard redirects authenticated users away from login/register
- [ ] Logout clears session and returns to login/home
- [ ] `/me` used to hydrate current user in UI
- [ ] Manual checklist documented in ticket PR description

### Out of scope
- Collection features
- Remember-me beyond Better Auth defaults

### Suggested commit
`feat: connect Angular auth flow to API`

---

## E1-T07 — Profile: pseudo + visibility

| | |
|---|---|
| **Type** | feat |
| **Priority** | Should |
| **Area** | API + web |
| **Depends on** | T03, T06 |
| **Blocks** | E6 social (pseudo search) |

### Goal
User can set unique `pseudo` and `isPublic` flag.

### Acceptance criteria
- [ ] `PATCH` (or Better Auth update + custom fields) for `pseudo` + `isPublic`
- [ ] Pseudo unique; validation errors clear in FR on UI
- [ ] Profile screen shows email (read-only), pseudo, public/private toggle
- [ ] `/me` returns updated fields
- [ ] Empty pseudo allowed until social (or required — pick one and document; prefer optional until E6)

### Out of scope
- Avatar upload
- Friends / share (E6)

### Suggested commit
`feat: add profile pseudo and visibility settings`

---

## E1-T08 — Google OAuth

| | |
|---|---|
| **Type** | feat |
| **Priority** | Should |
| **Area** | API + web |
| **Depends on** | T01, T06 |
| **Blocks** | — |
| **Note** | If Google ships on iOS later, Apple (T09) becomes required |

### Goal
Sign in / sign up with Google.

### Acceptance criteria
- [ ] Google provider configured in Better Auth
- [ ] Env vars in `.env.example` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- [ ] Web has “Continuer avec Google” button on login/register
- [ ] Successful OAuth creates/links account and session
- [ ] Failure shows FR error without leaking secrets

### Out of scope
- Apple (T09)
- Account linking edge-case admin UI

### Suggested commit
`feat: add Google OAuth sign-in`

---

## E1-T09 — Apple Sign In

| | |
|---|---|
| **Type** | feat |
| **Priority** | Must before iOS store if social login exists |
| **Area** | API + web/Capacitor |
| **Depends on** | T01; ideally after Capacitor (Sprint 4/5) |
| **Sprint** | **S5** (not S1) |

### Goal
Sign in with Apple for App Store compliance.

### Acceptance criteria
- [ ] Apple provider configured (client secret JWT / Better Auth Apple docs)
- [ ] Works on Capacitor iOS build
- [ ] Env vars documented; secrets never committed
- [ ] Same session model as email/Google

### Out of scope
- Android-only flows

### Suggested commit
`feat: add Apple Sign In`

---

## Sub-agent brief (copy-paste)

When launching a worker on a ticket:

```text
You are implementing ticket <ID> from docs/tickets/E1-identity.md in atasoif-v2.
Branch from up-to-date `dev`: feature/e1-<slug>
Follow .cursor/rules (EN code/docs, FR UI). Use Context7 for Better Auth / Nest / Angular.
Do not implement other E1 tickets. Do not copy atasoif.fr v1 UI.
Open a PR into `dev` when acceptance criteria are met. Conventional Commit EN, no AI co-author.
Report: files changed, checks run, leftover risks.
```

---

## Definition of done (every ticket)

- Acceptance criteria checked
- Relevant tests / lint / build run and reported
- No secrets committed
- Docs/env example updated if new config
- PR targets `dev`
