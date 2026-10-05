# `@atasoif/site` · landing marketing

Page marketing **Nuit** (Astro). Pages prerendered + endpoint waitlist Resend (`/api/waitlist`). Hébergement : Dokploy, image Node standalone (port **80**).

## Dev

```bash
# from monorepo root
bun install
cp apps/site/.env.example apps/site/.env   # fill RESEND_API_KEY for local send
bun run dev:site
# → http://localhost:4321
```

## Build / run

```bash
bun run build:site
# → apps/site/dist/ (client + server)

cd apps/site && bun run start
# HOST/PORT via env (Docker uses PORT=80)
```

## CTA mode

| `PUBLIC_CTA_MODE` | Comportement |
| --- | --- |
| `waitlist` (défaut) | Formulaire → `POST /api/waitlist` (ack user + copie `contact@`) |
| `stores` | Boutons iOS / Android (`PUBLIC_IOS_URL`, `PUBLIC_ANDROID_URL`) |

## Resend (site only)

Transactional mail for the **landing waitlist** goes through [Resend](https://resend.com). The Adonis API keeps OVH SMTP (`noreply@`) — do **not** mix providers.

| Variable | Role |
| --- | --- |
| `RESEND_API_KEY` | Runtime secret (Dokploy env) |
| `RESEND_FROM` | Default `À ta soif <noreply@atasoif.fr>` (verified domain) |
| `RESEND_REPLY_TO` | Default `contact@atasoif.fr` |
| `WAITLIST_NOTIFY_TO` | Internal copy; empty string disables |

DNS: verify `atasoif.fr` in Resend Domains (SPF + DKIM TXT). See `.env.example`.

## Docker (Dokploy)

```bash
docker build -f apps/site/Dockerfile -t atasoif-site .
```

- Build args : `PUBLIC_SITE_URL`, `PUBLIC_CTA_MODE`, `PUBLIC_IOS_URL`, `PUBLIC_ANDROID_URL`
- Runtime env (Dokploy) : `RESEND_API_KEY`, optional `RESEND_FROM`, `RESEND_REPLY_TO`, `WAITLIST_NOTIFY_TO`
- Port container : **80** (unchanged)

## Design source

- Maquette : `docs/conception/landing/`
- Tokens : `src/styles/_tokens.scss` (copie Nuit)
