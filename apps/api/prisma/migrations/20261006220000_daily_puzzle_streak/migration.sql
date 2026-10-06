-- AlterTable
ALTER TABLE "puzzle_attempts" ADD COLUMN     "daily_day" DATE;

-- CreateIndex
CREATE INDEX "puzzle_attempts_user_id_daily_day_idx" ON "puzzle_attempts"("user_id", "daily_day");
