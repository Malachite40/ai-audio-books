-- CreateTable
CREATE TABLE "PinnedEvaluation" (
    "id" TEXT NOT NULL,
    "redditPostEvaluationId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinnedEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PinnedEvaluation_redditPostEvaluationId_key" ON "PinnedEvaluation"("redditPostEvaluationId");

-- AddForeignKey
ALTER TABLE "PinnedEvaluation" ADD CONSTRAINT "PinnedEvaluation_redditPostEvaluationId_fkey" FOREIGN KEY ("redditPostEvaluationId") REFERENCES "RedditPostEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
