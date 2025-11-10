-- CreateTable
CREATE TABLE "RedditPost" (
    "id" TEXT NOT NULL,
    "redditId" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "url" TEXT,
    "permalink" TEXT NOT NULL,
    "createdUtc" TIMESTAMP(3) NOT NULL,
    "score" INTEGER,
    "numComments" INTEGER,
    "raw" JSONB,

    CONSTRAINT "RedditPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedditPost_redditId_key" ON "RedditPost"("redditId");

-- CreateIndex
CREATE INDEX "RedditPost_subreddit_category_createdUtc_idx" ON "RedditPost"("subreddit", "category", "createdUtc");
