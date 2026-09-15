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
RUN bun install --frozen-lockfile --filter @atasoif/api

FROM deps AS build
COPY apps/api/ ./apps/api/
WORKDIR /app/apps/api
# Build-time env (runtime values come from Compose)
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    LOG_LEVEL=info \
    APP_KEY=buildonlykeybuildonlykeybuildo \
    APP_URL=http://localhost:3000 \
    SESSION_DRIVER=cookie \
    DB_HOST=localhost \
    DB_PORT=5432 \
    DB_USER=atasoif \
    DB_PASSWORD=atasoif \
    DB_DATABASE=atasoif_v2 \
    GOOGLE_CLIENT_ID=placeholder \
    GOOGLE_CLIENT_SECRET=placeholder \
    FACEBOOK_CLIENT_ID=placeholder \
    FACEBOOK_CLIENT_SECRET=placeholder
RUN node ace build --package-manager=bun \
  && cd build \
  && bun install --production

# Runtime image: Node only (no Bun required at runtime)
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/build ./
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
