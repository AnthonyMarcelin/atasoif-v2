# syntax=docker/dockerfile:1

FROM oven/bun:1.4-alpine AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/site/package.json ./apps/site/package.json
# Workspace stubs so bun lock resolves (site-only image)
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN bun install --frozen-lockfile --filter @atasoif/site

COPY apps/site ./apps/site

WORKDIR /app/apps/site
ARG PUBLIC_SITE_URL=https://atasoif.fr
ARG PUBLIC_CTA_MODE=waitlist
ARG PUBLIC_IOS_URL=#ios
ARG PUBLIC_ANDROID_URL=#android
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL \
    PUBLIC_CTA_MODE=$PUBLIC_CTA_MODE \
    PUBLIC_IOS_URL=$PUBLIC_IOS_URL \
    PUBLIC_ANDROID_URL=$PUBLIC_ANDROID_URL
RUN bun run build

FROM nginx:1.27-alpine AS runtime
COPY apps/site/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/site/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
