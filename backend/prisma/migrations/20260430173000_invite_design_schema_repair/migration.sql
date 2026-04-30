-- Repair migration for invite design schema drift.
-- Safe to run on partially migrated databases.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InviteDesignStatus') THEN
    CREATE TYPE "InviteDesignStatus" AS ENUM ('draft', 'published', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InviteDesignAssetType') THEN
    CREATE TYPE "InviteDesignAssetType" AS ENUM ('image', 'font', 'sticker', 'icon', 'audio');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InviteExportFormat') THEN
    CREATE TYPE "InviteExportFormat" AS ENUM ('png', 'jpg', 'pdf');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "invite_designs" (
  "id" SERIAL PRIMARY KEY,
  "event_id" INTEGER NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "category" VARCHAR(80),
  "status" "InviteDesignStatus" NOT NULL DEFAULT 'draft',
  "canvas_size" VARCHAR(40) NOT NULL DEFAULT '1080x1920',
  "language" VARCHAR(10) NOT NULL DEFAULT 'en',
  "json_layout" JSONB NOT NULL DEFAULT '{}',
  "preview_url" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invite_designs_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "invite_design_assets" (
  "id" SERIAL PRIMARY KEY,
  "design_id" INTEGER NOT NULL,
  "type" "InviteDesignAssetType" NOT NULL,
  "url" VARCHAR(500) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invite_design_assets_design_id_fkey"
    FOREIGN KEY ("design_id") REFERENCES "invite_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "invite_design_exports" (
  "id" SERIAL PRIMARY KEY,
  "design_id" INTEGER NOT NULL,
  "format" "InviteExportFormat" NOT NULL,
  "file_url" VARCHAR(500) NOT NULL,
  "file_key" VARCHAR(500),
  "width" INTEGER,
  "height" INTEGER,
  "created_by_user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invite_design_exports_design_id_fkey"
    FOREIGN KEY ("design_id") REFERENCES "invite_designs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "guests"
  ADD COLUMN IF NOT EXISTS "invite_design_id" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'guests_invite_design_id_fkey'
  ) THEN
    ALTER TABLE "guests"
      ADD CONSTRAINT "guests_invite_design_id_fkey"
      FOREIGN KEY ("invite_design_id") REFERENCES "invite_designs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "invite_designs_event_id_status_idx"
  ON "invite_designs"("event_id", "status");

CREATE INDEX IF NOT EXISTS "invite_designs_event_id_updated_at_idx"
  ON "invite_designs"("event_id", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "invite_design_assets_design_id_type_idx"
  ON "invite_design_assets"("design_id", "type");

CREATE INDEX IF NOT EXISTS "invite_design_exports_design_id_created_at_idx"
  ON "invite_design_exports"("design_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "guests_invite_design_id_idx"
  ON "guests"("invite_design_id");
