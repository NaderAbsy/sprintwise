-- CreateTable
CREATE TABLE "security_counts" (
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "security_counts_pkey" PRIMARY KEY ("day","kind")
);
