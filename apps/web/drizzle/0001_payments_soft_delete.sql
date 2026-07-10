ALTER TABLE "bookings" ADD COLUMN "payment_status" "payment_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_paid_per_booking_uq" ON "payments" USING btree ("booking_id") WHERE status = 'paid' and deleted_at is null and booking_id is not null;