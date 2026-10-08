-- v2.6: Atlassian's personal data reporting. One row per stored Atlassian account ID: when it's next due.
CREATE TABLE "atlassian_reports" (
    "accountId" TEXT NOT NULL,
    "nextReportAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlassian_reports_pkey" PRIMARY KEY ("accountId")
);
