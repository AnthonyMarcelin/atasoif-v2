# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app

FROM base AS deps
COPY apps/api/package.json apps/api/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY apps/api/ ./
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
RUN node ace build

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
