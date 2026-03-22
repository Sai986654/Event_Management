# Backend API — use when Render (or Docker) builds from the monorepo root.
# For builds with Root Directory = backend, use backend/Dockerfile instead.
FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/ .
RUN npx prisma generate

EXPOSE 5000

# Apply migrations then start (works when DATABASE_URL / DIRECT_URL are set at runtime)
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
