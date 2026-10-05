-- AlterTable
ALTER TABLE "snapshots" ADD COLUMN     "auto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sprints" ADD COLUMN     "tracksBacklog" BOOLEAN NOT NULL DEFAULT false;

