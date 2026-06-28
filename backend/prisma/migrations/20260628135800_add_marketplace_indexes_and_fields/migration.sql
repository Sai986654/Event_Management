-- AlterTable - Add marketplace optimization columns
ALTER TABLE "vendors"
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "starting_price" INTEGER,
  ADD COLUMN IF NOT EXISTS "min_price" INTEGER,
  ADD COLUMN IF NOT EXISTS "max_price" INTEGER;

-- CreateIndex - Index fields for sorting and filtering
CREATE INDEX IF NOT EXISTS "vendors_category_idx" ON "vendors"("category");
CREATE INDEX IF NOT EXISTS "vendors_city_idx" ON "vendors"("city");
CREATE INDEX IF NOT EXISTS "vendors_average_rating_idx" ON "vendors"("average_rating" DESC);
CREATE INDEX IF NOT EXISTS "vendors_is_verified_idx" ON "vendors"("is_verified");
CREATE INDEX IF NOT EXISTS "vendors_featured_idx" ON "vendors"("featured");
CREATE INDEX IF NOT EXISTS "vendors_starting_price_idx" ON "vendors"("starting_price");
CREATE INDEX IF NOT EXISTS "vendors_created_at_idx" ON "vendors"("created_at" DESC);

-- CreateIndex - Review rating index
CREATE INDEX IF NOT EXISTS "reviews_vendor_id_rating_idx" ON "reviews"("vendor_id", "rating" DESC);

-- CreateIndex - Booking service date index
CREATE INDEX IF NOT EXISTS "bookings_vendor_id_service_date_idx" ON "bookings"("vendor_id", "service_date");

-- CreateIndex - Full-text search index (Phase 1 FTS)
CREATE INDEX IF NOT EXISTS "idx_vendors_fts" ON "vendors" USING gin(to_tsvector('english', coalesce(business_name, '') || ' ' || coalesce(category, '') || ' ' || coalesce(city, '') || ' ' || coalesce(description, '')));
