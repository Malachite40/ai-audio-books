-- AlterTable
ALTER TABLE "public"."SupportSubmission" ADD COLUMN     "email" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "SupportSubmission_userId_createdAt_idx" ON "public"."SupportSubmission"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."SupportSubmission" ADD CONSTRAINT "SupportSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
