/*
  Warnings:

  - You are about to drop the column `gptCondLatent` on the `Speaker` table. All the data in the column will be lost.
  - You are about to drop the column `speakerEmbedding` on the `Speaker` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Speaker" DROP COLUMN "gptCondLatent",
DROP COLUMN "speakerEmbedding";
