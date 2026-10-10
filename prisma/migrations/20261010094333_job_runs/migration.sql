-- CreateTable
CREATE TABLE "job_runs" (
    "name" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "summary" TEXT NOT NULL,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("name")
);
