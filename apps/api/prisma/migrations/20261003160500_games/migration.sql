-- CreateEnum
CREATE TYPE "game_status" AS ENUM ('active', 'finished');

-- CreateTable
CREATE TABLE "games" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bot_id" TEXT NOT NULL,
    "user_color" CHAR(1) NOT NULL,
    "learning" BOOLEAN NOT NULL DEFAULT true,
    "status" "game_status" NOT NULL DEFAULT 'active',
    "moves" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hints_used" INTEGER NOT NULL DEFAULT 0,
    "outcome" TEXT,
    "end_reason" TEXT,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "games_user_id_status_idx" ON "games"("user_id", "status");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

