-- Repair migration for payment schema drift.
-- Safe to run repeatedly across partially migrated databases.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'initiated', 'completed', 'failed', 'refunded');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('razorpay', 'upi', 'card', 'netbanking');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentEntityType') THEN
    CREATE TYPE "PaymentEntityType" AS ENUM ('event', 'booking', 'order', 'surprise_page', 'invite_design_export', 'vendor_portfolio');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "payments" (
  "id" SERIAL PRIMARY KEY,
  "razorpay_order_id" VARCHAR(120) NOT NULL,
  "razorpay_payment_id" VARCHAR(120),
  "razorpay_signature" VARCHAR(500),
  "razorpay_refund_id" VARCHAR(120),
  "user_id" INTEGER NOT NULL,
  "entity_type" "PaymentEntityType" NOT NULL,
  "entity_id" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
  "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
  "payment_method" "PaymentMethod",
  "description" TEXT,
  "notes" JSONB NOT NULL DEFAULT '{}',
  "receipt_id" VARCHAR(120),
  "failure_reason" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "completed_at" TIMESTAMP(3),
  "refunded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "payment_configurations" (
  "id" SERIAL PRIMARY KEY,
  "entity_type" "PaymentEntityType" NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT false,
  "amount" DECIMAL(12,2),
  "description" TEXT,
  "allow_manual_override" BOOLEAN NOT NULL DEFAULT true,
  "notes" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "payment_webhook_logs" (
  "id" SERIAL PRIMARY KEY,
  "webhook_id" VARCHAR(120) NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "error" TEXT,
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_razorpay_order_id_key"
  ON "payments"("razorpay_order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_configurations_entity_type_key"
  ON "payment_configurations"("entity_type");

CREATE INDEX IF NOT EXISTS "payments_user_id_status_idx"
  ON "payments"("user_id", "status");

CREATE INDEX IF NOT EXISTS "payments_entity_type_entity_id_idx"
  ON "payments"("entity_type", "entity_id");

CREATE INDEX IF NOT EXISTS "payments_razorpay_order_id_idx"
  ON "payments"("razorpay_order_id");

CREATE INDEX IF NOT EXISTS "payments_created_at_idx"
  ON "payments"("created_at" DESC);

CREATE INDEX IF NOT EXISTS "payment_webhook_logs_webhook_id_idx"
  ON "payment_webhook_logs"("webhook_id");

CREATE INDEX IF NOT EXISTS "payment_webhook_logs_event_type_processed_idx"
  ON "payment_webhook_logs"("event_type", "processed");
