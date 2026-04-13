-- CreateTable: service_categories
CREATE TABLE "service_categories" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "color" VARCHAR(30) NOT NULL DEFAULT 'default',
    "icon" VARCHAR(60),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_name_key" ON "service_categories"("name");

-- Add social_links column to vendors (was missing from earlier migrations)
ALTER TABLE "vendors" ADD COLUMN IF NOT EXISTS "social_links" JSONB NOT NULL DEFAULT '{}';

-- Convert enum columns to varchar
ALTER TABLE "vendors" ALTER COLUMN "category" TYPE VARCHAR(60) USING "category"::text;
ALTER TABLE "vendor_packages" ALTER COLUMN "category" TYPE VARCHAR(60) USING "category"::text;
ALTER TABLE "event_order_items" ALTER COLUMN "category" TYPE VARCHAR(60) USING "category"::text;
ALTER TABLE "event_activities" ALTER COLUMN "category" TYPE VARCHAR(60) USING "category"::text;

-- Drop the enum (no longer needed)
DROP TYPE IF EXISTS "VendorCategory";

-- Seed default categories
INSERT INTO "service_categories" ("name", "label", "color", "sort_order") VALUES
  ('catering',       'Catering',       'orange',  1),
  ('decor',          'Decor',          'purple',  2),
  ('photography',    'Photography',    'blue',    3),
  ('videography',    'Videography',    'cyan',    4),
  ('music',          'Music',          'magenta', 5),
  ('venue',          'Venue',          'green',   6),
  ('florist',        'Florist',        'pink',    7),
  ('transportation', 'Transportation', 'gold',    8),
  ('other',          'Other',          'default', 9);
