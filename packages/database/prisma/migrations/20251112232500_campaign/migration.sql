/*
  Warnings:

  - Added the required column `campaignId` to the `RedditWatchList` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "RedditWatchList_subreddit_key";

-- AlterTable
ALTER TABLE "RedditPostEvaluation" ADD COLUMN     "campaignId" TEXT;

-- AlterTable
ALTER TABLE "RedditWatchList" ADD COLUMN     "campaignId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RedditWatchList" ADD CONSTRAINT "RedditWatchList_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedditPostEvaluation" ADD CONSTRAINT "RedditPostEvaluation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
