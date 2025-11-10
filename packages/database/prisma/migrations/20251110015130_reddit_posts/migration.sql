-- CreateTable
CREATE TABLE "RedditWatchList" (
    "id" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedditWatchList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedditWatchList_subreddit_key" ON "RedditWatchList"("subreddit");
