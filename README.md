# EventOS — Event Management Platform

Monorepo: **backend** (Node + Express + Prisma), **frontend** (React), **mobile** (Expo / React Native).

## Repository layout

| Folder       | Description |
|-------------|-------------|
| `backend/`  | REST API, Socket.io, Prisma/PostgreSQL, seeds, AI/invite/media features |
| `frontend/` | Organizer/admin/customer web app (Create React App) |
| `mobile/`   | Expo app for planners, vendors, guests (public invites, etc.) |

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 14+ (local or hosted)
- **npm** (or use `pnpm`/`yarn` per app if you prefer)

## Quick start (local)

### 1. Database

Create a database and set `DATABASE_URL` in `backend/.env` (copy from `backend/.env.example`).

### 2. Backend

```bash
cd backend
cp .env.example .env   # then edit DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma generate
npx prisma migrate deploy   # production / CI
# or: npx prisma migrate dev  # local development
npm run seed                  # optional sample data
npm run dev                   # http://localhost:5000 (or port in .env)
```

See **`backend/prisma/MIGRATIONS.md`** for migration / baselining notes.

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # if present; set REACT_APP_API_URL to your API base URL
npm install
npm start              # http://localhost:3000
```

### 4. Mobile

```bash
cd mobile
npm install
npx expo start
```

Point the app at your API (see `mobile/src/services/api.js` or env pattern your project uses).

## Environment variables

- **Backend**: `backend/.env.example` — database, JWT, Cloudinary, invite/UPI, WhatsApp, AI keys, etc.
- Never commit real `.env` files. Use your host’s secret manager in production.

## Scripts reference

| Location   | Common commands |
|-----------|------------------|
| `backend` | `npm run dev`, `npm start`, `npm run seed`, `npm test`, `npx prisma migrate deploy` |
| `frontend`| `npm start`, `npm run build`, `npm test` |
| `mobile`  | `npm start`, `npx expo start` |

## CI (GitHub Actions)

Workflows under `.github/workflows/` run on pull requests and pushes to `main`:

- **Backend** — install, `prisma validate` / `generate`, tests against PostgreSQL service (when applicable).
- **Frontend** — install and production build (`CI=true`).
- **Mobile** — install dependencies (sanity check).

## Deployment (high level)

1. Provision **PostgreSQL** and set `DATABASE_URL` on the server.
2. Deploy **backend**: run `npx prisma migrate deploy` then `npm start` (or use a process manager).
3. Build **frontend** (`npm run build`) and host the `build/` folder (static hosting or CDN).
4. **Mobile**: configure production API URL, then build with EAS or `expo export` per your release process.

## Contributing

See **[CONTRIBUTING.md](./CONTRIBUTING.md)** for branches, PRs, and commit conventions.

## License

Private / your license — update this section when you publish terms.
