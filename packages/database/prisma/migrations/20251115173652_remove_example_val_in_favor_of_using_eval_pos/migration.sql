/*
  Warnings:

  - You are about to drop the `ExampleEvaluation` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ExampleEvaluation" DROP CONSTRAINT "ExampleEvaluation_redditPostEvaluationId_fkey";

-- AlterTable
ALTER TABLE "RedditPostEvaluation" ADD COLUMN     "bookmarked" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "ExampleEvaluation";
