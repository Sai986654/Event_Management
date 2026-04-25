-- Store selected invite card template per guest
ALTER TABLE "guests"
  ADD COLUMN "invite_template_key" VARCHAR(50);
