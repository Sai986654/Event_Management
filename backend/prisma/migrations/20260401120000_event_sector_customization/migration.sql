-- Sector customization support for customer event planning
ALTER TABLE "events" ADD COLUMN "sector_customizations" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "events" ADD COLUMN "customer_preferences" JSONB NOT NULL DEFAULT '{}';
