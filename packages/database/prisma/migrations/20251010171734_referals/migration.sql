-- CreateEnum
CREATE TYPE "public"."ReferralEventType" AS ENUM ('CLICK', 'SIGNUP', 'PAID');

-- CreateTable
CREATE TABLE "public"."ReferralLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "signupCount" INTEGER NOT NULL DEFAULT 0,
    "paidCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReferralLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReferralEvent" (
    "id" TEXT NOT NULL,
    "referralLinkId" TEXT NOT NULL,
    "type" "public"."ReferralEventType" NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "referredUserId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralLink_userId_key" ON "public"."ReferralLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralLink_code_key" ON "public"."ReferralLink"("code");

-- CreateIndex
CREATE INDEX "ReferralEvent_referralLinkId_type_idx" ON "public"."ReferralEvent"("referralLinkId", "type");

-- CreateIndex
CREATE INDEX "ReferralEvent_referredUserId_idx" ON "public"."ReferralEvent"("referredUserId");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "public"."CreditTransaction"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."ReferralLink" ADD CONSTRAINT "ReferralLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReferralEvent" ADD CONSTRAINT "ReferralEvent_referralLinkId_fkey" FOREIGN KEY ("referralLinkId") REFERENCES "public"."ReferralLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
