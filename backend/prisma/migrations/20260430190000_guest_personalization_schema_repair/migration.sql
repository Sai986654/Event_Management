-- Repair migration for guest personalization schema drift.
-- Safe to run repeatedly across partially migrated databases.

ALTER TABLE "guests"
  ADD COLUMN IF NOT EXISTS "relationship" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "invite_tone" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "invite_language" VARCHAR(10) NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS "invite_template_key" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "personalized_layout_overrides" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "custom_invite_message" TEXT,
  ADD COLUMN IF NOT EXISTS "personalized_invite_message" TEXT,
  ADD COLUMN IF NOT EXISTS "personalized_invite_pdf_url" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "personalized_invite_pdf_key" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "invite_token" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "invitation_generated_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "guests_invite_token_key"
  ON "guests"("invite_token");

-- Ensure default exists for invite language in drifted databases.
ALTER TABLE "guests"
  ALTER COLUMN "invite_language" SET DEFAULT 'en';
