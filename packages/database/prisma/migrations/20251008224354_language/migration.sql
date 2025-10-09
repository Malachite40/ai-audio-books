-- CreateEnum
CREATE TYPE "public"."Language" AS ENUM ('ENGLISH', 'GERMAN', 'CHINESE', 'FRENCH', 'SPANISH', 'KOREAN', 'ITALIAN', 'PORTUGUESE', 'JAPANESE', 'RUSSIAN', 'POLISH', 'DUTCH');

-- AlterTable
ALTER TABLE "public"."Speaker" ADD COLUMN     "language" "public"."Language" NOT NULL DEFAULT 'ENGLISH';
