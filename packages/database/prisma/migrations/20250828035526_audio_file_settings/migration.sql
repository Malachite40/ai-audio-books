-- CreateTable
CREATE TABLE "public"."AudioFileSettings" (
    "audioFileId" TEXT NOT NULL,
    "currentTime" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AudioFileSettings_pkey" PRIMARY KEY ("audioFileId","userId")
);

-- AddForeignKey
ALTER TABLE "public"."AudioFileSettings" ADD CONSTRAINT "AudioFileSettings_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "public"."AudioFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AudioFileSettings" ADD CONSTRAINT "AudioFileSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
