-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('active', 'past_due', 'canceled', 'expired');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'succeeded', 'canceled');

-- CreateEnum
CREATE TYPE "payment_purpose" AS ENUM ('initial', 'renewal');

-- CreateTable
CREATE TABLE "subscriptions" (
    "user_id" UUID NOT NULL,
    "plan_key" TEXT NOT NULL,
    "status" "subscription_status" NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "payment_method_id" TEXT,
    "card_last4" CHAR(4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_key" TEXT NOT NULL,
    "purpose" "payment_purpose" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "amount_kopecks" INTEGER NOT NULL,
    "provider_payment_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

