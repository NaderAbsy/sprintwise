-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "jiraLeftOut" JSONB;

-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "jiraBase" JSONB;
