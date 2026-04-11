-- Store organizer preference for share/QR destination
ALTER TABLE "events" ADD COLUMN "qr_destination_type" VARCHAR(20) NOT NULL DEFAULT 'auto';
