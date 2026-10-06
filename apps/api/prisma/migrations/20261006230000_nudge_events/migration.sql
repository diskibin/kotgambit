-- AlterEnum
ALTER TYPE "analytics_event_name" ADD VALUE 'nudge_view';
ALTER TYPE "analytics_event_name" ADD VALUE 'nudge_click';

-- AlterTable
ALTER TABLE "analytics_events" ADD COLUMN     "detail" TEXT;
