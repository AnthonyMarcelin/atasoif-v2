# `@atasoif/site` · landing marketing

Page marketing **Nuit** (Astro, sortie statique). Hébergement cible : Dokploy / nginx sur le VPS.

## Dev

```bash
# from monorepo root
bun install
bun run dev:site
# → http://localhost:4321
```

## Build

```bash
bun run build:site
# → apps/site/dist/
```

## CTA mode

| `PUBLIC_CTA_MODE` | Comportement |
| --- | --- |
| `waitlist` (défaut) | Formulaire email « Être prévenu » (UI only jusqu’à endpoint API) |
| `stores` | Boutons iOS / Android (`PUBLIC_IOS_URL`, `PUBLIC_ANDROID_URL`) |

Voir `.env.example`.

## Docker (Dokploy)

```bash
docker build -f apps/site/Dockerfile -t atasoif-site .
```

Build args : `PUBLIC_SITE_URL`, `PUBLIC_CTA_MODE`, `PUBLIC_IOS_URL`, `PUBLIC_ANDROID_URL`.

## Design source

- Maquette : `docs/conception/landing/`
- Tokens : `src/styles/_tokens.scss` (copie Nuit)
