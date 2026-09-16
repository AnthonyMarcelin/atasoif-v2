# Bun tooling · À ta soif v2

## Decision

Use **Bun** as the monorepo package manager and script runner.  
Keep **Node.js ≥ 24** as the AdonisJS 7 runtime.

Official Adonis docs target Node 24+ for install, `ace`, and production (`node bin/server.js`). Bun installs deps and runs Angular / shared scripts (optionally with `--bun`). Adonis is **not** a supported Bun runtime (notably `reflect-metadata` / IoC). Do not run `ace serve` or the API server under Bun.

## Prerequisites

| Tool | Version |
|---|---|
| Bun | ≥ 1.2 (repo pinned via `packageManager`: `bun@1.4.2`) |
| Node.js | ≥ 24 (required for Adonis 7) |

```bash
# Bun: https://bun.com/install
curl -fsSL https://bun.com/install | bash

# Node 24 via nvm / Herd / system package
node -v   # must be v24+
bun -v
```

## Install

```bash
cd atasoif-v2
bun install
bun run build:shared
```

Workspaces: `apps/*` + `packages/*` (including `@atasoif/api`).  
Lockfile: root `bun.lock`. Config: `bunfig.toml` (`run.bun = false` so `node` stays Node for Adonis).

## Day-to-day commands

```bash
bun run dev          # api + web in parallel (--filter / --parallel)
bun run dev:api      # Node: node ace serve --hmr → :3000
bun run dev:web      # Angular via Bun runtime (--bun) → :4200
bun run build        # shared → api → web (--sequential)
bun run build:api
bun run build:web
bun run build:shared
bun run lint         # all workspaces in parallel
bun run test:api
bun run db:migrate
bun run db:seed
```

Native Bun advantages used here:

- `--filter` / `--parallel` / `--sequential` / `--if-present` for monorepo scripts
- `--bun` on web/shared so CLI shebangs (`ng`, `tsc`) run on Bun, not Node
- `trustedDependencies` for native lifecycle scripts (`better-sqlite3`, `esbuild`, …)
- Bun shell via `bunfig.toml` (`[run] shell = "bun"`)

## Docker

Compose still runs **Postgres 16** + API. The API image:

1. Installs workspace deps with **Bun** (`bun install --frozen-lockfile --filter @atasoif/api`)
2. Builds with **Node** (`node ace build --package-manager=bun`)
3. Installs production deps in `build/` with **Bun** (`bun install --production`)
4. Runs on **Node** only (`node:24-alpine` entrypoint · no Bun in the final image)

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
| Combined `bun run dev` (api side) | Must not use global `run.bun = true` |

## Migration from pnpm/npm

Removed: `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `apps/api/package-lock.json`.  
Added: root `workspaces` in `package.json`, `bun.lock`, `bunfig.toml`, `packageManager: bun@1.4.2`.
