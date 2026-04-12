# Contributing to Vedika 360

## Repository structure

This is a **monorepo**. Prefer changes that keep `backend`, `frontend`, and `mobile` in sync when you touch APIs or shared behavior.

## Branching

- **`main`** — stable, deployable code.
- **Feature branches** — `feat/short-description`, `fix/issue-description`, `chore/...`.

Optional: add a **`develop`** branch if you want a staging integration line before `main`.

## Pull requests

1. Branch from `main` (or `develop` if you use it).
2. Keep PRs focused (one feature or fix when possible).
3. Update **README** or **env examples** if you add new configuration.
4. Ensure **CI passes** (GitHub Actions).
5. For API changes: update **frontend** and/or **mobile** clients in the same PR when practical.

## Commits

Conventional-style messages help history and changelogs:

- `feat: add public invite slug API`
- `fix: INR budget sum on dashboard`
- `docs: deployment notes in README`
- `chore: bump prisma`

## Local checks before pushing

```bash
# Backend
cd backend && npm test && npx prisma validate

# Frontend
cd frontend && npm run build

# Mobile
cd mobile && npm install   # ensure lockfile resolves
```

## Database migrations

- **Local iteration**: `npx prisma migrate dev` (from `backend/`).
- **Production / staging**: `npx prisma migrate deploy` only.
- Do not edit applied migration files; add a new migration for schema changes.

See `backend/prisma/MIGRATIONS.md`.

## Security

- No secrets in code or committed `.env` files.
- Use GitHub **Secrets** for CI tokens if you add deploy workflows later.
