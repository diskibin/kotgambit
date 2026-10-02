-- AlterTable
-- Existing rows get a placeholder, the seed script rewrites them from the content files right after.
ALTER TABLE "lessons" ADD COLUMN "piece" TEXT NOT NULL DEFAULT 'k';
ALTER TABLE "lessons" ALTER COLUMN "piece" DROP DEFAULT;
