# Bun tooling — À ta soif v2

## Decision

Use **Bun** as the monorepo package manager (and for most local scripts).  
Keep **Node.js ≥ 24** as the AdonisJS 7 runtime.

Official Adonis docs target Node 24+ for install, `ace`, and production (`node bin/server.js`). Bun can install dependencies and run Angular/shared scripts, but Adonis is **not** fully supported as a Bun runtime (notably `reflect-metadata` / IoC). Do not run `ace serve` or the API server under Bun.

## Prerequisites

| Tool | Version |
|---|---|
| Bun | ≥ 1.2 (repo pinned via `packageManager`: `bun@1.4.2`) |
| Node.js | ≥ 24 (required for Adonis 7) |

```bash
# Bun — https://bun.com/install
curl -fsSL https://bun.com/install | bash

# Node 24 via nvm / Herd / system package
node -v   # must be v24+
bun -v
```

## Install

```bash
cd atasoif-v2
bun install
bun run --filter @atasoif/shared build
```

Workspaces: `apps/*` + `packages/*` (including `@atasoif/api`).  
Lockfile: root `bun.lock` (replaces `pnpm-lock.yaml` and `apps/api/package-lock.json`).

## Day-to-day commands

```bash
bun run dev:api      # Node: node ace serve --hmr → :3000
bun run dev:web      # Angular via Bun → :4200
bun run build        # API (Node ace) + web
bun run build:api
bun run build:web
bun run lint
bun run test:api     # node ace test
bun run db:migrate   # node ace migration:run
bun run db:seed
```

Equivalent from a package:

```bash
bun run --filter @atasoif/api dev
bun run --filter @atasoif/web start
cd apps/api && node ace serve --hmr   # explicit Node path
```

## Docker

Compose still runs **Postgres 16** + API. The API image:

1. Installs workspace deps with **Bun** (`bun install --frozen-lockfile --filter @atasoif/api`)
2. Builds with **Node** (`node ace build --package-manager=bun`)
3. Installs production deps in `build/` with **Bun** (`bun install --production`)
4. Runs on **Node** only (`node:24-alpine` entrypoint — no Bun in the final image)

```bash
bun run docker:dev
bun run docker:prod
bun run docker:down
```

## Node-only gaps (intentional)

| Surface | Why Node |
|---|---|
| `node ace serve --hmr` / `dev:api` | Adonis assembler + HMR on Node |
| `node ace build` / `test` / migrations | Ace CLI documented for Node |
| `node bin/server.js` (prod + Docker entrypoint) | Adonis production runtime |
| Docker final process | `node:24-alpine` + Node entrypoint |

Bun is used for: root installs, workspace filters, Angular/`shared` scripts, and Docker dependency installs.

## Migration from pnpm/npm

Removed: `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `apps/api/package-lock.json`.  
Added: root `workspaces` in `package.json`, `bun.lock`, `packageManager: bun@1.4.2`.
