#!/bin/sh
# Used by Docker and production hosts: apply pending migrations, then start the API.
# DIRECT_URL falls back to DATABASE_URL when only the latter is set (e.g. Render).
set -e
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

# Baseline: if _prisma_migrations table doesn't exist yet, mark all existing
# migrations as applied so migrate deploy won't try to re-create existing tables.
echo "[deploy] checking migration baseline..."
npx prisma migrate resolve --applied 202603202250_phase1_foundation 2>/dev/null || true
npx prisma migrate resolve --applied 20260328120000_app_notifications 2>/dev/null || true
npx prisma migrate resolve --applied 20260329120000_event_invite_drip 2>/dev/null || true
npx prisma migrate resolve --applied 20260401120000_event_sector_customization 2>/dev/null || true
npx prisma migrate resolve --applied 20260401153000_ai_fit_snapshots 2>/dev/null || true
npx prisma migrate resolve --applied 20260401164500_event_netlify_site 2>/dev/null || true
npx prisma migrate resolve --applied 20260401173000_event_qr_destination_type 2>/dev/null || true
npx prisma migrate resolve --applied 20260413120000_dynamic_categories 2>/dev/null || true
npx prisma migrate resolve --applied 20260413140000_instant_photo_download 2>/dev/null || true
npx prisma migrate resolve --applied 20260418120000_live_chat 2>/dev/null || true

echo "[deploy] checking failed migration recovery for 20260419120000_raw_material_items..."
RAW_ITEMS_TABLE_EXISTS=$(node -e "const { Client } = require('pg'); (async () => { try { const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }); await client.connect(); const result = await client.query(\"SELECT to_regclass('public.raw_material_items') AS table_name\"); process.stdout.write(result.rows?.[0]?.table_name ? '1' : '0'); await client.end(); } catch (_error) { process.stdout.write('0'); } })();" 2>/dev/null || echo "0")

if [ "$RAW_ITEMS_TABLE_EXISTS" = "1" ]; then
	echo "[deploy] raw_material_items exists, resolving migration as applied"
	npx prisma migrate resolve --applied 20260419120000_raw_material_items 2>/dev/null || true
else
	echo "[deploy] raw_material_items not found, resolving failed state as rolled back"
	npx prisma migrate resolve --rolled-back 20260419120000_raw_material_items 2>/dev/null || true
fi

echo "[deploy] prisma migrate deploy"
# Note: 20260419120000_raw_material_items will be applied by migrate deploy below
npx prisma migrate deploy
echo "[deploy] node server.js"
exec node server.js
