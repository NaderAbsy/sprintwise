-- v1.10: stories remember their epic, and projects remember the CSV columns picked at the last import.
ALTER TABLE "stories" ADD COLUMN "epic" TEXT NOT NULL DEFAULT '';
ALTER TABLE "projects" ADD COLUMN "importColumns" JSONB NOT NULL DEFAULT '{}';
