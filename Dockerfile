# Backend API — use when Render (or Docker) builds from the monorepo root.
# For builds with Root Directory = backend, use backend/Dockerfile instead.
FROM node:20-alpine

# Prisma engines need OpenSSL on Alpine (avoids libssl detection warnings)
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ .
RUN npx prisma generate

EXPOSE 5000

RUN chmod +x scripts/start-production.sh

# Migrations run on every container start (see backend/scripts/start-production.sh).
CMD ["npm", "run", "start:prod"]
