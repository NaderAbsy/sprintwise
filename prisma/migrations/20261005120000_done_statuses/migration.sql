-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "doneStatuses" TEXT[] DEFAULT ARRAY['Done', 'Closed', 'Resolved']::TEXT[];

