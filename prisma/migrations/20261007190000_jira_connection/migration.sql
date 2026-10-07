-- v2.2: a project remembers the Jira site and search it imports from and syncs with.
ALTER TABLE "projects" ADD COLUMN "jiraCloudId" TEXT;
ALTER TABLE "projects" ADD COLUMN "jiraSiteName" TEXT;
ALTER TABLE "projects" ADD COLUMN "jiraSiteUrl" TEXT;
ALTER TABLE "projects" ADD COLUMN "jiraJql" TEXT;
ALTER TABLE "projects" ADD COLUMN "jiraSyncedAt" TIMESTAMP(3);
