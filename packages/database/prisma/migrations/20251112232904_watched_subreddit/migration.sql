/*
  Warnings:

  - You are about to drop the `watchedSubreddit` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "watchedSubreddit" DROP CONSTRAINT "watchedSubreddit_campaignId_fkey";

-- DropTable
DROP TABLE "watchedSubreddit";

-- CreateTable
CREATE TABLE "WatchedSubreddit" (
    "campaignId" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchedSubreddit_pkey" PRIMARY KEY ("campaignId","subreddit")
);

-- AddForeignKey
ALTER TABLE "WatchedSubreddit" ADD CONSTRAINT "WatchedSubreddit_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
