-- CreateTable: instant_photos (live photo wall)
CREATE TABLE "instant_photos" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "public_id" TEXT,
    "caption" VARCHAR(500),
    "uploaded_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instant_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instant_photos_event_id_created_at_idx" ON "instant_photos"("event_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "instant_photos" ADD CONSTRAINT "instant_photos_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instant_photos" ADD CONSTRAINT "instant_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
