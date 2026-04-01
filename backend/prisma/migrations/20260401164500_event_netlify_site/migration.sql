-- Store per-event Netlify microsite metadata
ALTER TABLE "events" ADD COLUMN "netlify_site_id" VARCHAR(120);
ALTER TABLE "events" ADD COLUMN "netlify_site_url" VARCHAR(500);
ALTER TABLE "events" ADD COLUMN "netlify_published_at" TIMESTAMP(3);
