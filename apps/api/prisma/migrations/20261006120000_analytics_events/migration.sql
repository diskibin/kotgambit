-- CreateEnum
CREATE TYPE "analytics_event_name" AS ENUM ('visit', 'signed_in', 'premium_view', 'checkout_start');

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "visitor_id" UUID NOT NULL,
    "name" "analytics_event_name" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_name_created_at_idx" ON "analytics_events"("name", "created_at");
