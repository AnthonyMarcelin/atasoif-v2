#!/bin/sh
set -e

cd /app
echo "Running Prisma migrations..."
pnpm --filter @atasoif/api exec prisma migrate deploy

cd /app/apps/api
echo "Starting API..."
if [ -f dist/main.js ]; then
  exec node dist/main.js
elif [ -f dist/src/main.js ]; then
  exec node dist/src/main.js
else
  echo "Could not find Nest build output under dist/"
  ls -laR dist || true
  exit 1
fi
