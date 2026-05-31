-- Sync invite template schema with Prisma models used by admin/template-engine controllers.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InviteTemplateStatus') THEN
    CREATE TYPE "InviteTemplateStatus" AS ENUM ('draft', 'published', 'archived');
  END IF;
END $$;

ALTER TABLE "invite_templates"
  ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "theme_key" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "status" "InviteTemplateStatus" NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "config_json" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "component_visibility_json" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "ai_meta_json" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "latest_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "invite_templates_status_updated_at_idx"
  ON "invite_templates"("status", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "invite_templates_event_type_theme_key_status_idx"
  ON "invite_templates"("event_type", "theme_key", "status");

CREATE TABLE IF NOT EXISTS "invite_template_versions" (
  "id" SERIAL NOT NULL,
  "template_id" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "InviteTemplateStatus" NOT NULL DEFAULT 'draft',
  "config_json" JSONB NOT NULL DEFAULT '{}',
  "component_visibility" JSONB NOT NULL DEFAULT '{}',
  "ai_meta_json" JSONB NOT NULL DEFAULT '{}',
  "created_by_user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invite_template_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invite_template_versions_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "invite_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "invite_template_versions_template_id_version_key"
  ON "invite_template_versions"("template_id", "version");

CREATE INDEX IF NOT EXISTS "invite_template_versions_template_id_created_at_idx"
  ON "invite_template_versions"("template_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "invite_component_presets" (
  "id" SERIAL NOT NULL,
  "template_id" INTEGER NOT NULL,
  "component_type" VARCHAR(80) NOT NULL,
  "component_key" VARCHAR(80) NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "config_json" JSONB NOT NULL DEFAULT '{}',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invite_component_presets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invite_component_presets_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "invite_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "invite_component_presets_template_id_component_key_key"
  ON "invite_component_presets"("template_id", "component_key");

CREATE INDEX IF NOT EXISTS "invite_component_presets_template_id_component_type_sort_order_idx"
  ON "invite_component_presets"("template_id", "component_type", "sort_order");