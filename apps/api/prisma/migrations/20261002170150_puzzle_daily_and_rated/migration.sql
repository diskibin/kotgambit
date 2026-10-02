-- AlterTable
ALTER TABLE "puzzle_attempts" ADD COLUMN     "rated" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "daily_puzzles" (
    "day" DATE NOT NULL,
    "puzzle_id" TEXT NOT NULL,

    CONSTRAINT "daily_puzzles_pkey" PRIMARY KEY ("day")
);

-- AddForeignKey
ALTER TABLE "daily_puzzles" ADD CONSTRAINT "daily_puzzles_puzzle_id_fkey" FOREIGN KEY ("puzzle_id") REFERENCES "puzzles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
