-- CreateTable
CREATE TABLE "public"."SupportSubmission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportSubmission_pkey" PRIMARY KEY ("id")
);
