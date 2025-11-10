-- CreateTable
CREATE TABLE "RedditPostEvaluation" (
    "id" TEXT NOT NULL,
    "redditPostId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasoning" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedditPostEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedditPostEvaluation_redditPostId_key" ON "RedditPostEvaluation"("redditPostId");

-- CreateIndex
CREATE INDEX "RedditPostEvaluation_score_createdAt_idx" ON "RedditPostEvaluation"("score", "createdAt");

-- AddForeignKey
ALTER TABLE "RedditPostEvaluation" ADD CONSTRAINT "RedditPostEvaluation_redditPostId_fkey" FOREIGN KEY ("redditPostId") REFERENCES "RedditPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
