-- CreateEnum
CREATE TYPE "AudioFileStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'ERROR');

-- CreateEnum
CREATE TYPE "AudioChunkStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'ERROR');

-- CreateTable
CREATE TABLE "AudioFile" (
    "id" TEXT NOT NULL,
    "status" "AudioFileStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioChunk" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "AudioChunkStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audioFileId" TEXT NOT NULL,

    CONSTRAINT "AudioChunk_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AudioChunk" ADD CONSTRAINT "AudioChunk_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "AudioFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
