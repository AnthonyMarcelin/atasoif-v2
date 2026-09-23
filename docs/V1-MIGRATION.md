# Railway v1 → Adonis v2 migration (E2-T11)

One-shot Ace command that imports the small v1 cohort (users + argon2id passwords + cellar) into Lucid.

## Prerequisites

1. V2 Postgres migrated + categories seeded (`bun run db:migrate` · `bun run db:seed`).
2. `DATABASE_PUBLIC_URL` = Railway **public** Postgres URL for the v1 database (SSL).  
   Cloud / VPS secret only — **never** commit it. JSON exports do **not** contain password hashes.
3. Optional peer: `argon2` (already in `apps/api` dependencies) so Auth can verify `$argon2id$` hashes. New signups stay on **scrypt**.

## Commands

```bash
cd apps/api

# Plan only (no writes)
DATABASE_PUBLIC_URL='postgresql://…' node ace migrate:v1 --dry-run

# Apply (idempotent — safe to re-run)
DATABASE_PUBLIC_URL='postgresql://…' node ace migrate:v1

# Optional: sanitized JSON export dir + live passwords from Railway
DATABASE_PUBLIC_URL='postgresql://…' node ace migrate:v1 --from=/var/lib/atasoif/v1-export
```

`--database-url` overrides the env var for that run (still never logged).

## Behaviour

| Area | Rule |
|------|------|
| Users | All v1 rows except duplicate `lplin@orange.fr` **id 16** (keep **15**) |
| Passwords | Copy `$argon2id$` PHC as-is (raw insert, no re-hash) |
| Premium | `subscriptions` ACTIVE · `provider=legacy_v1` · `plan=yearly` · `current_period_end=null` |
| Catalog | Match `lower(name)` + category, else create + `bottle_sources` (`source=legacy_v1`, `external_id=table:id`) |
| Memory | `bought_at` ← supplier name/address · `note` as-is · `fill_level=100` · photo → `photo_url_override` |
| Idempotence | User by email · cellar by `legacy_v1` bottle source + user_bottle link |

Canonical owner identity: `tongo33@gmail.com`.

## Security

- Do not put password hashes in git, fixtures committed to the repo, or logs.
- The command redacts `postgresql://…` and `$argon2…` fragments from error output.
- `legacy_v1` subscriptions are an entitlement exception until E4 IAP — not RevenueCat rows.
