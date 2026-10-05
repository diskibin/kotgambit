-- CreateEnum
CREATE TYPE "oauth_provider" AS ENUM ('google', 'yandex', 'vk');

-- CreateTable
CREATE TABLE "identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "oauth_provider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "identities_user_id_idx" ON "identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "identities_provider_provider_user_id_key" ON "identities"("provider", "provider_user_id");

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
