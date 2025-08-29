/*
  Warnings:

  - You are about to drop the column `duration` on the `AudioChunk` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."AudioChunk" DROP COLUMN "duration",
ADD COLUMN     "durationMs" INTEGER NOT NULL DEFAULT 0;
