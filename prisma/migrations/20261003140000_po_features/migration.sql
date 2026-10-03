-- AlterTable
ALTER TABLE "changes" ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "customChecks" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "sprints" ADD COLUMN     "goal" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "goalOutcome" TEXT,
ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sprints_shareToken_key" ON "sprints"("shareToken");

