# Database Migrations - Permanent Fix

## 🎯 Overview

Database migrations are now **automatically applied on server startup** with comprehensive error handling and recovery mechanisms. This is a permanent solution to migration issues.

## ✅ Quick Start

### Option 1: Automatic (Recommended)
Just start the server - migrations apply automatically:
```bash
npm start
# or for development:
npm run dev
```

### Option 2: Manual Setup
```bash
npm run db:init
npm start
```

## 📋 Available Commands

| Command | Purpose |
|---------|---------|
| `npm start` | Start server (auto-applies migrations) |
| `npm run dev` | Start with auto-reload (auto-applies migrations) |
| `npm run db:init` | Manual database initialization with validation |
| `npm run migrate:status` | Check if any migrations are pending |
| `npm run migrate:resolve` | Resolve shadow DB conflicts |
| `npm run migrate:deploy` | Deploy migrations (production) |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run db:reset` | ⚠️ Delete all data and reset (dev only) |

## 🔧 What Was Fixed

### Issues Resolved
- ✅ Migrations now apply automatically on server startup
- ✅ Shadow database validation errors are handled automatically
- ✅ No manual conflict resolution needed
- ✅ Better error logging and debugging
- ✅ Retry logic with exponential backoff
- ✅ Migration status visible in `/api/health` endpoint

### Architecture Changes

#### New File: `utils/databaseSetup.js`
- Automatic migration initialization during startup
- Shadow database error recovery
- Retry mechanism with exponential backoff
- Provides migration state information

#### New File: `scripts/initialize-migrations.js`
- Standalone migration initialization script
- Detailed color-coded output
- CLI options: `--deploy`, `--validate`, `--reset`
- Can be used in CI/CD pipelines

#### Updated: `server.js`
- Calls `ensureDatabaseReady()` before starting services
- Exits with error if migrations fail (prevents broken state)
- Includes migration status in health check endpoint

## 🚀 Deployment Guide

### Local Development
```bash
npm run dev
# Migrations apply automatically on startup
```

### Docker / Production
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend .
RUN npm install
# Migrations will run automatically on container start
CMD ["npm", "start"]
```

### CI/CD Pipeline (GitHub Actions Example)
```yaml
- name: Initialize Database
  run: npm run db:init --prefix backend
  
- name: Run Tests
  run: npm test --prefix backend
  
- name: Deploy
  run: npm run start:prod --prefix backend
```

## 📊 Health Check

Monitor migration status:
```bash
curl http://localhost:5000/api/health | jq .migrations
```

Response example:
```json
{
  "migrations": {
    "initialized": true,
    "hasPendingMigrations": false,
    "lastCheck": "2026-04-30T10:30:00.000Z"
  }
}
```

## 🔍 Troubleshooting

### Problem: Shadow Database Validation Error (P1014)

**Symptoms:**
- Server won't start
- Error message contains "P1014" or "shadow"

**Solution:**
```bash
npm run migrate:resolve
npm start
```

### Problem: Cannot Connect to Database

**Check environment variables:**
```bash
echo $DATABASE_URL
echo $DIRECT_URL
```

**Required for PostgreSQL:**
```bash
export DATABASE_URL=postgresql://user:password@localhost:5432/vedika360
export DIRECT_URL=postgresql://user:password@localhost:5432/vedika360
```

### Problem: Migrations Still Pending After Server Startup

**The server exits if migrations fail to prevent data corruption.**

Check status:
```bash
npm run migrate:status
```

Deploy manually:
```bash
npm run migrate:deploy
```

Start again:
```bash
npm start
```

### Problem: Development Database Already Has Tables

If you created tables via `db push` or manually:

```bash
npm run migrate:resolve
npm start
```

This marks the baseline migration as already applied.

## 📝 For Developers

### Creating New Migrations

After updating `prisma/schema.prisma`:

```bash
npm run prisma:migrate
# Creates migration file in prisma/migrations/
# Review the SQL, then commit
```

### Viewing Migration History

```bash
ls -la backend/prisma/migrations/
```

Each folder contains:
- `migration.sql` - The actual SQL changes
- `migration_lock.toml` - Provider lock file

### Understanding Logs

#### ✓ Success
```
[DB] ✓ Schema is valid
[DB] ✓ Prisma client generated
[DB] ✓ No pending migrations
[DB] ✓ Database ready - all migrations applied
```

#### ⚠ Recovery
```
[DB] ⚠ Found pending migrations
[DB] Deploying pending migrations...
[DB] ✓ Migrations deployed successfully
```

#### ✗ Failure
```
[DB] ✗ Failed to deploy migrations: [error details]
[DB] Please run: npm run migrate:deploy
```

## 🔐 Production Deployment Checklist

Before deploying to production:

- [ ] All environment variables set (`DATABASE_URL`, `DIRECT_URL`)
- [ ] Database server is running and accessible
- [ ] Run `npm run db:init` to verify migrations work
- [ ] Check `/api/health` shows migrations initialized
- [ ] Review migration SQL files before deploying
- [ ] Have database backup before running migrations
- [ ] Monitor logs during initial deployment

## 📚 Migration Files Structure

```
backend/
├── prisma/
│   ├── schema.prisma              # Current schema definition
│   ├── MIGRATIONS.md              # Old migration docs (replaced)
│   ├── MIGRATIONS_PERMANENT.md    # ← You are here
│   └── migrations/
│       ├── 202603202250_phase1_foundation/
│       │   └── migration.sql      # Baseline: Creates all tables
│       ├── 20260328120000_app_notifications/
│       │   └── migration.sql
│       ├── ...more migrations...
│       └── migration_lock.toml
├── config/
│   └── db.js                      # Connection config
├── utils/
│   └── databaseSetup.js           # ← NEW: Auto-migration logic
├── scripts/
│   └── initialize-migrations.js   # ← NEW: Manual init script
└── server.js                      # ← UPDATED: Calls databaseSetup
```

## 🎓 How It Works

1. **Server Startup**
   - `npm start` calls `start()` in `server.js`
   - Server begins listening on port

2. **Migration Initialization**
   - `ensureDatabaseReady()` from `utils/databaseSetup.js` is called
   - Validates schema, generates client, checks for pending migrations
   - If pending: Deploys with error recovery

3. **Error Recovery**
   - Shadow database errors are caught and handled
   - Automatically retries with fallback strategy
   - Exits cleanly if all retries fail

4. **Service Startup**
   - Only if migrations succeed, services start (cron jobs, etc.)
   - Health check endpoint includes migration status

5. **Ongoing**
   - Each `/api/health` check includes current migration state
   - Logs show all migration activity

## 🆘 Getting Help

If migrations still fail after trying these steps:

1. Check database connectivity:
   ```bash
   psql "$DATABASE_URL" -c "\dt"
   ```

2. View migration files:
   ```bash
   ls -la backend/prisma/migrations/
   ```

3. Check Prisma status:
   ```bash
   npm run migrate:status
   ```

4. Review full logs:
   ```bash
   npm run db:init 2>&1 | tee migration.log
   ```

5. Manual deployment:
   ```bash
   npm run migrate:deploy
   ```

## 📖 Reference

- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Shadow Database](https://www.prisma.io/docs/concepts/components/prisma-migrate/shadow-database)
