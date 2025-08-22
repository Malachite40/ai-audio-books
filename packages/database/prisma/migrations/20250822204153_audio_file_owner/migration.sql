-- AlterTable
ALTER TABLE "public"."AudioFile" ADD COLUMN     "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."AudioFile" ADD CONSTRAINT "AudioFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
