#!/bin/sh
# Used by Docker and production hosts: apply pending migrations, then start the API.
# DIRECT_URL falls back to DATABASE_URL when only the latter is set (e.g. Render).
set -e
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

echo "[deploy] prisma migrate deploy"
npx prisma migrate deploy

echo "[deploy] prisma generate"
npx prisma generate

echo "[deploy] node server.js"
exec node server.js
