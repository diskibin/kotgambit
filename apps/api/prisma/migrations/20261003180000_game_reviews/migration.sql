-- CreateEnum
CREATE TYPE "review_status" AS ENUM ('pending', 'running', 'done', 'failed');

-- CreateTable
CREATE TABLE "game_reviews" (
    "game_id" UUID NOT NULL,
    "status" "review_status" NOT NULL DEFAULT 'pending',
    "done" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "game_reviews_pkey" PRIMARY KEY ("game_id")
);

-- AddForeignKey
ALTER TABLE "game_reviews" ADD CONSTRAINT "game_reviews_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

