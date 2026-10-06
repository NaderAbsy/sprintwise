-- AlterTable
ALTER TABLE "stories" ADD COLUMN     "rank" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "stories_projectId_rank_idx" ON "stories"("projectId", "rank");


-- Existing backlogs start in key order, with numbers compared as numbers (PROJ-2 before PROJ-10).
UPDATE "stories" AS s
SET "rank" = ordered.position
FROM (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "projectId"
    ORDER BY regexp_replace("key", '[0-9]+$', ''), NULLIF(substring("key" from '([0-9]+)$'), '')::numeric NULLS FIRST, "key"
  ) AS position
  FROM "stories"
) AS ordered
WHERE s."id" = ordered."id";
