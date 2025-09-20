-- CreateTable
CREATE TABLE "public"."Emails" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "group" TEXT,
    "isContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Emails_pkey" PRIMARY KEY ("id")
);
