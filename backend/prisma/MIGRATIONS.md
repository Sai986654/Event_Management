# Prisma migrations

## What was wrong

The migration `202603202250_phase1_foundation` was **incremental**: it ran `ALTER TABLE "vendors"` and created new tables, but it **never created** `users`, `events`, or `vendors`.  

Prisma replays all migrations on an **empty shadow database** to validate them, so that migration failed with **P1014** (`vendors` does not exist).

## What we did

That migration file was replaced with a **full baseline**: `CREATE TABLE` for every model in `schema.prisma`, in dependency order. Shadow DB validation can succeed.

## Commands for your situation

### 1) Empty / new database

```bash
cd backend
npx prisma migrate dev
```

### 2) Database already has tables (e.g. you used `db push` or created tables manually)

Do **not** re-apply the baseline SQL (you will get “relation already exists”). Tell Prisma this migration is already satisfied:

```bash
cd backend
npx prisma migrate resolve --applied "202603202250_phase1_foundation"
```

Then use `migrate dev` only for **new** migrations after this one.

### 3) `_prisma_migrations` has the old migration checksum and Prisma complains the file changed

Delete the row for `202603202250_phase1_foundation` from `_prisma_migrations` in Postgres, then run either (1) or (2) as appropriate.

### Production / CI (no shadow DB issues)

```bash
npx prisma migrate deploy
```
