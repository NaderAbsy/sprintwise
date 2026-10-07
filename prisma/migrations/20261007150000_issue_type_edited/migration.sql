-- v1.12: stories keep Jira's issue type, and remember when they were edited in Sprintwise.
ALTER TABLE "stories" ADD COLUMN "issueType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "stories" ADD COLUMN "editedAt" TIMESTAMP(3);
