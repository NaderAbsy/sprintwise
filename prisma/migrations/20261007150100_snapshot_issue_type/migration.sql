-- v1.12: snapshot rows keep the issue type too, so planning readiness scores bugs and tasks the same way.
ALTER TABLE "snapshot_items" ADD COLUMN "issueType" TEXT NOT NULL DEFAULT '';
