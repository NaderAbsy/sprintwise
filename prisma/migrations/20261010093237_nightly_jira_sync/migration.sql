-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "jiraAutoSynced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jiraSyncError" TEXT,
ADD COLUMN     "nightlySync" BOOLEAN NOT NULL DEFAULT true;
