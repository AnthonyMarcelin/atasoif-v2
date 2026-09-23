# Railway v1 → Adonis v2 cellar export (E2-T11)

Sanitized JSON only — **no password hashes**.

```bash
# From apps/api, with DATABASE_PUBLIC_URL set (Railway public Postgres):
node ace migrate:v1-cellar --dry-run
node ace migrate:v1-cellar
```

Passwords (`$argon2id$`) are fetched live at migrate time and written into `users.password` without re-hashing through AuthFinder.

Idempotency: `bottle_sources.external_id = v1:{whisky|beer|rhum}:{id}`.
