-- Invite drip scheduling (AI copy + WhatsApp to guests)
ALTER TABLE "events" ADD COLUMN "invite_drip_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "invite_drip_interval_days" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "events" ADD COLUMN "invite_drip_last_sent_at" TIMESTAMP(3);
ALTER TABLE "events" ADD COLUMN "invite_drip_video_url" VARCHAR(500);
