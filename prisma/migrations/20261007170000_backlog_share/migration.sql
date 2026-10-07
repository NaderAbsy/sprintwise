-- Read-only backlog links: a secret token per project, null when not shared.
ALTER TABLE "projects" ADD COLUMN "shareToken" TEXT;
CREATE UNIQUE INDEX "projects_shareToken_key" ON "projects"("shareToken");
