-- CreateIndex
CREATE INDEX "changes_fromSnapshotId_idx" ON "changes"("fromSnapshotId");

-- CreateIndex
CREATE INDEX "changes_toSnapshotId_idx" ON "changes"("toSnapshotId");
