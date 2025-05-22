/*
  Warnings:

  - Added the required column `speakerId` to the `AudioFile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AudioFile" ADD COLUMN     "speakerId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "AudioFile" ADD CONSTRAINT "AudioFile_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "Speaker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
