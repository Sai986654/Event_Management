-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'organizer', 'customer', 'vendor', 'guest');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('wedding', 'corporate', 'birthday', 'conference', 'concert', 'other');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('draft', 'planning', 'confirmed', 'ongoing', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('catering', 'decor', 'photography', 'videography', 'music', 'venue', 'florist', 'transportation', 'other');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('fixed', 'per_person', 'hourly', 'custom');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('draft', 'quoted', 'placed', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'blocked');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('pending', 'accepted', 'declined', 'maybe');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('photo', 'video');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'organizer',
    "phone" TEXT,
    "avatar" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "venue" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "budget" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "guest_count" INTEGER NOT NULL DEFAULT 0,
    "organizer_id" INTEGER NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'draft',
    "cover_image" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "timeline" JSONB NOT NULL DEFAULT '[]',
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "business_name" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "price_type" "PriceType" NOT NULL DEFAULT 'fixed',
    "packages" JSONB NOT NULL DEFAULT '[]',
    "portfolio" JSONB NOT NULL DEFAULT '[]',
    "availability" JSONB NOT NULL DEFAULT '[]',
    "city" TEXT,
    "state" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "website" TEXT,
    "average_rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMP(3),
    "verified_by_admin_id" INTEGER,
    "verification_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_packages" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "tier" VARCHAR(80) NOT NULL,
    "base_price" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
    "unit_label" TEXT,
    "estimation_rules" JSONB NOT NULL DEFAULT '{}',
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_testimonials" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "client_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "source" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_orders" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "quoted_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "final_total" DECIMAL(12,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "package_id" INTEGER NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "package_title" TEXT NOT NULL,
    "criteria_snapshot" JSONB NOT NULL DEFAULT '{}',
    "quoted_price" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_activities" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "vendor_id" INTEGER,
    "category" "VendorCategory" NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'not_started',
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "spend_planned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "spend_actual" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updated_by_id" INTEGER,
    "updated_by_user_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "price" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "service_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "rsvp_status" "RsvpStatus" NOT NULL DEFAULT 'pending',
    "plus_ones" INTEGER NOT NULL DEFAULT 0,
    "dietary_preferences" TEXT,
    "table_assignment" TEXT,
    "qr_code" TEXT,
    "checked_in" BOOLEAN NOT NULL DEFAULT false,
    "checked_in_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "total_budget" DECIMAL(12,2) NOT NULL,
    "guest_count" INTEGER NOT NULL,
    "allocations" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "vendor_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "event_id" INTEGER,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "uploaded_by" INTEGER,
    "guest_name" TEXT,
    "url" TEXT NOT NULL,
    "public_id" TEXT,
    "type" "MediaType" NOT NULL DEFAULT 'photo',
    "caption" VARCHAR(500),
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");

-- CreateIndex
CREATE INDEX "events_organizer_id_date_idx" ON "events"("organizer_id", "date");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_user_id_key" ON "vendors"("user_id");

-- CreateIndex
CREATE INDEX "vendors_category_idx" ON "vendors"("category");

-- CreateIndex
CREATE INDEX "vendors_city_idx" ON "vendors"("city");

-- CreateIndex
CREATE INDEX "vendors_average_rating_idx" ON "vendors"("average_rating");

-- CreateIndex
CREATE INDEX "vendor_packages_vendor_id_category_idx" ON "vendor_packages"("vendor_id", "category");

-- CreateIndex
CREATE INDEX "vendor_testimonials_vendor_id_idx" ON "vendor_testimonials"("vendor_id");

-- CreateIndex
CREATE INDEX "event_orders_customer_id_status_idx" ON "event_orders"("customer_id", "status");

-- CreateIndex
CREATE INDEX "event_orders_organizer_id_status_idx" ON "event_orders"("organizer_id", "status");

-- CreateIndex
CREATE INDEX "event_order_items_order_id_category_idx" ON "event_order_items"("order_id", "category");

-- CreateIndex
CREATE INDEX "event_activities_event_id_category_idx" ON "event_activities"("event_id", "category");

-- CreateIndex
CREATE INDEX "event_activities_order_id_status_idx" ON "event_activities"("order_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_event_id_vendor_id_key" ON "bookings"("event_id", "vendor_id");

-- CreateIndex
CREATE INDEX "guests_event_id_idx" ON "guests"("event_id");

-- CreateIndex
CREATE INDEX "guests_event_id_email_idx" ON "guests"("event_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_event_id_key" ON "budgets"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_vendor_id_user_id_key" ON "reviews"("vendor_id", "user_id");

-- CreateIndex
CREATE INDEX "media_event_id_idx" ON "media"("event_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_verified_by_admin_id_fkey" FOREIGN KEY ("verified_by_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_packages" ADD CONSTRAINT "vendor_packages_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_testimonials" ADD CONSTRAINT "vendor_testimonials_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_orders" ADD CONSTRAINT "event_orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_orders" ADD CONSTRAINT "event_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_orders" ADD CONSTRAINT "event_orders_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_order_items" ADD CONSTRAINT "event_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "event_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_order_items" ADD CONSTRAINT "event_order_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_order_items" ADD CONSTRAINT "event_order_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "vendor_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_activities" ADD CONSTRAINT "event_activities_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "event_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_activities" ADD CONSTRAINT "event_activities_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_activities" ADD CONSTRAINT "event_activities_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_activities" ADD CONSTRAINT "event_activities_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
