/*
  Warnings:

  - A unique constraint covering the columns `[redditPostId,campaignId]` on the table `RedditPostEvaluation` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "RedditPostEvaluation_redditPostId_key";

-- CreateIndex
CREATE UNIQUE INDEX "RedditPostEvaluation_redditPostId_campaignId_key" ON "RedditPostEvaluation"("redditPostId", "campaignId");
