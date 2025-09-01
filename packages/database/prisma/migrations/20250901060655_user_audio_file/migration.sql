-- CreateTable
CREATE TABLE "public"."UserAudioFile" (
    "userId" TEXT NOT NULL,
    "audioFileId" TEXT NOT NULL,

    CONSTRAINT "UserAudioFile_pkey" PRIMARY KEY ("userId","audioFileId")
);

-- AddForeignKey
ALTER TABLE "public"."UserAudioFile" ADD CONSTRAINT "UserAudioFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAudioFile" ADD CONSTRAINT "UserAudioFile_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "public"."AudioFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
