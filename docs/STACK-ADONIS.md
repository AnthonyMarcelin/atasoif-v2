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

## What we drop

- NestJS (archived under `archive/nest-api`)
- Prisma / Better Auth
- Better Auth–era E1 tickets (rewritten for Auth + Ally)

## What we keep

- `apps/web` (Angular)
- `packages/shared`
- Postgres + Docker Compose topology
- Product docs, JTBD, epics (backend tech notes updated)
