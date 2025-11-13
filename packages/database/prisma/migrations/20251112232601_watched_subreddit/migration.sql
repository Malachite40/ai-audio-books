/*
  Warnings:

  - You are about to drop the `RedditWatchList` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RedditWatchList" DROP CONSTRAINT "RedditWatchList_campaignId_fkey";

-- DropTable
DROP TABLE "RedditWatchList";

-- CreateTable
CREATE TABLE "watchedSubreddit" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "watchedSubreddit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "watchedSubreddit" ADD CONSTRAINT "watchedSubreddit_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
