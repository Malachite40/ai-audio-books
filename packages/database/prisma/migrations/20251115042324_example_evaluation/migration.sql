/*
  Warnings:

  - You are about to drop the `PinnedEvaluation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PinnedEvaluation" DROP CONSTRAINT "PinnedEvaluation_redditPostEvaluationId_fkey";

-- DropTable
DROP TABLE "PinnedEvaluation";

-- CreateTable
CREATE TABLE "ExampleEvaluation" (
    "id" TEXT NOT NULL,
    "modifiedContent" TEXT,
    "redditPostEvaluationId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExampleEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExampleEvaluation_redditPostEvaluationId_key" ON "ExampleEvaluation"("redditPostEvaluationId");

-- AddForeignKey
ALTER TABLE "ExampleEvaluation" ADD CONSTRAINT "ExampleEvaluation_redditPostEvaluationId_fkey" FOREIGN KEY ("redditPostEvaluationId") REFERENCES "RedditPostEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
