-- AlterTable
ALTER TABLE "puzzle_attempts" ALTER COLUMN "played_moves" SET DEFAULT ARRAY[]::TEXT[];
