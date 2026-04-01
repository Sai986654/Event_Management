-- Persist event-vendor fit snapshots for analytics and recommendation quality tracking
CREATE TABLE "ai_recommendation_snapshots" (
  "id" SERIAL PRIMARY KEY,
  "event_id" INTEGER NOT NULL,
  "user_id" INTEGER,
  "category" VARCHAR(64),
  "vendor_id" INTEGER NOT NULL,
  "fit_score" INTEGER NOT NULL,
  "confidence" VARCHAR(16),
  "reasons" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ai_recommendation_snapshots_event_category_created_idx"
  ON "ai_recommendation_snapshots"("event_id", "category", "created_at");

CREATE INDEX "ai_recommendation_snapshots_vendor_created_idx"
  ON "ai_recommendation_snapshots"("vendor_id", "created_at");
