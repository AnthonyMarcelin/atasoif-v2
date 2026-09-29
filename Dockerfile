# syntax=docker/dockerfile:1
# AdonisJS 7 requires the Node.js runtime (official docs: Node ≥ 24).
# Bun is used as the package manager during image build; the final process is Node.

FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl bash unzip \
  && curl -fsSL https://bun.com/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
# Workspace stubs so bun lock resolves (api + shared image)
COPY apps/web/package.json ./apps/web/package.json
COPY apps/site/package.json ./apps/site/package.json
RUN bun install --frozen-lockfile --filter @atasoif/api --filter @atasoif/shared

FROM deps AS build
COPY packages/shared ./packages/shared
RUN bun --filter @atasoif/shared build
COPY apps/api/ ./apps/api/
WORKDIR /app/apps/api
# Build-time env (runtime values come from Compose / Dokploy)
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    LOG_LEVEL=info \
    APP_KEY=buildonlykeybuildonlykeybuildo \
    APP_URL=http://localhost:3000 \
    FRONTEND_URL=http://localhost:4200 \
    SESSION_DRIVER=cookie \
    DB_HOST=localhost \
    DB_PORT=5432 \
    DB_USER=atasoif \
    DB_PASSWORD=atasoif \
    DB_DATABASE=atasoif_v2 \
    MAIL_MAILER=smtp \
    MAIL_FROM_NAME=Atasoif \
    MAIL_FROM_ADDRESS=hello@atasoif.local \
    SMTP_HOST=localhost \
    SMTP_PORT=1025 \
    OFF_API_BASE_URL=https://world.openfoodfacts.org \
    OFF_USER_AGENT="Atasoif/0.1 (hello@atasoif.local)" \
    UPCITEMDB_ENABLED=true \
    UPCITEMDB_API_BASE_URL=https://api.upcitemdb.com/prod/trial \
    GOOGLE_CLIENT_ID=placeholder \
    GOOGLE_CLIENT_SECRET=placeholder \
    FACEBOOK_CLIENT_ID=placeholder \
    FACEBOOK_CLIENT_SECRET=placeholder
RUN node ace build --package-manager=bun \
  && mkdir -p build/node_modules/@atasoif \
  && cp -a /app/packages/shared build/node_modules/@atasoif/shared \
  && node --input-type=module -e "\
import { readFileSync, writeFileSync } from 'node:fs';\
const p = JSON.parse(readFileSync('build/package.json', 'utf8'));\
if (p.dependencies?.['@atasoif/shared']) {\
  p.dependencies['@atasoif/shared'] = 'file:./node_modules/@atasoif/shared';\
  writeFileSync('build/package.json', JSON.stringify(p, null, 2) + '\\n');\
}\
" \
  && cd build \
  && bun install --production

# Runtime image: Node only (no Bun required at runtime)
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S atasoif && adduser -S atasoif -G atasoif
COPY --from=build /app/apps/api/build ./
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
  && chown -R atasoif:atasoif /app
USER atasoif
EXPOSE 3000
# start-period covers Lucid migrate + Adonis boot against remote Postgres
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./docker-entrypoint.sh"]
