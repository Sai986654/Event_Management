-- Database-managed invite template catalog
CREATE TABLE "invite_templates" (
  "id" SERIAL NOT NULL,
  "key" VARCHAR(50) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(280),
  "palette" JSONB NOT NULL DEFAULT '{}',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invite_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invite_templates_key_key" ON "invite_templates"("key");
CREATE INDEX "invite_templates_is_active_sort_order_idx" ON "invite_templates"("is_active", "sort_order");
