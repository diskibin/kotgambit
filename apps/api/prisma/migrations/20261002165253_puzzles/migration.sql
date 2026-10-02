-- CreateEnum
CREATE TYPE "puzzle_attempt_status" AS ENUM ('open', 'solved', 'failed', 'abandoned');

-- CreateTable
CREATE TABLE "puzzles" (
    "id" TEXT NOT NULL,
    "fen" TEXT NOT NULL,
    "moves" TEXT[],
    "rating" INTEGER NOT NULL,
    "rating_deviation" INTEGER NOT NULL,
    "popularity" INTEGER NOT NULL,
    "plays" INTEGER NOT NULL,
    "themes" TEXT[],
    "opening_tags" TEXT[],

    CONSTRAINT "puzzles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puzzle_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "puzzle_id" TEXT NOT NULL,
    "status" "puzzle_attempt_status" NOT NULL DEFAULT 'open',
    "mistakes" INTEGER NOT NULL DEFAULT 0,
    "hint_level" INTEGER NOT NULL DEFAULT 0,
    "played_moves" TEXT[],
    "solved_at" TIMESTAMP(3),
    "rating_before" INTEGER NOT NULL,
    "rating_after" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "puzzle_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_puzzle_stats" (
    "user_id" UUID NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "solved" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "best_streak" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_puzzle_stats_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "puzzles_rating_idx" ON "puzzles"("rating");

-- CreateIndex
CREATE INDEX "puzzles_themes_idx" ON "puzzles" USING GIN ("themes");

-- CreateIndex
CREATE INDEX "puzzle_attempts_user_id_started_at_idx" ON "puzzle_attempts"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "puzzle_attempts_user_id_puzzle_id_idx" ON "puzzle_attempts"("user_id", "puzzle_id");

-- AddForeignKey
ALTER TABLE "puzzle_attempts" ADD CONSTRAINT "puzzle_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puzzle_attempts" ADD CONSTRAINT "puzzle_attempts_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_puzzle_stats" ADD CONSTRAINT "user_puzzle_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
