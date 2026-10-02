-- AlterTable
ALTER TABLE "puzzle_attempts" ADD COLUMN     "move_hint_at" INTEGER NOT NULL DEFAULT -1,
ADD COLUMN     "move_hint_level" INTEGER NOT NULL DEFAULT 0;
