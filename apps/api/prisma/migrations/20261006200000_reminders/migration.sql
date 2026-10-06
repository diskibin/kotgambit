-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_reminder_at" TIMESTAMP(3),
ADD COLUMN     "reminders_enabled" BOOLEAN NOT NULL DEFAULT false;
