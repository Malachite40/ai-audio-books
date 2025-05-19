/*
  Warnings:

  - A unique constraint covering the columns `[audioFileId,sequence]` on the table `AudioChunk` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sequence` to the `AudioChunk` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AudioChunk" ADD COLUMN     "sequence" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AudioChunk_audioFileId_sequence_key" ON "AudioChunk"("audioFileId", "sequence");
