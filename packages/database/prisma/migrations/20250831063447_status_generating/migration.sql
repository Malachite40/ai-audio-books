/*
  Warnings:

  - The values [GENERATING_STORY] on the enum `AudioChunkStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."AudioChunkStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'ERROR');
ALTER TABLE "public"."AudioChunk" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."AudioChunk" ALTER COLUMN "status" TYPE "public"."AudioChunkStatus_new" USING ("status"::text::"public"."AudioChunkStatus_new");
ALTER TYPE "public"."AudioChunkStatus" RENAME TO "AudioChunkStatus_old";
ALTER TYPE "public"."AudioChunkStatus_new" RENAME TO "AudioChunkStatus";
DROP TYPE "public"."AudioChunkStatus_old";
ALTER TABLE "public"."AudioChunk" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
ALTER TYPE "public"."AudioFileStatus" ADD VALUE 'GENERATING_STORY';
