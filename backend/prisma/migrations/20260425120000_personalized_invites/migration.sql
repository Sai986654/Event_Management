-- Personalized digital invite metadata for each guest
ALTER TABLE "guests"
  ADD COLUMN "relationship" VARCHAR(80),
  ADD COLUMN "invite_tone" VARCHAR(30),
  ADD COLUMN "invite_language" VARCHAR(10) NOT NULL DEFAULT 'en',
  ADD COLUMN "custom_invite_message" TEXT,
  ADD COLUMN "personalized_invite_message" TEXT,
  ADD COLUMN "personalized_invite_pdf_url" VARCHAR(500),
  ADD COLUMN "personalized_invite_pdf_key" VARCHAR(500),
  ADD COLUMN "invite_token" VARCHAR(64),
  ADD COLUMN "invitation_generated_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "guests_invite_token_key" ON "guests"("invite_token");
