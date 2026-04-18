-- CreateTable
CREATE TABLE "raw_material_items" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "item_name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "photo_url" VARCHAR(500),
    "categories" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_material_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "raw_material_items_vendor_id_is_active_idx" ON "raw_material_items"("vendor_id", "is_active");

-- AddForeignKey
ALTER TABLE "raw_material_items" ADD CONSTRAINT "raw_material_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
