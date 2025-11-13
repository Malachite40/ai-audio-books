/*
  Warnings:

  - Made the column `campaignId` on table `RedditPostEvaluation` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "RedditPostEvaluation" DROP CONSTRAINT "RedditPostEvaluation_campaignId_fkey";

-- AlterTable
ALTER TABLE "RedditPostEvaluation" ALTER COLUMN "campaignId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "RedditPostEvaluation" ADD CONSTRAINT "RedditPostEvaluation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
