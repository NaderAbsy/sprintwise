-- CreateTable
CREATE TABLE "action_limits" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_limits_pkey" PRIMARY KEY ("key")
);
