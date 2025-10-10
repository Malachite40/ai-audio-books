/*
  Warnings:

  - You are about to drop the column `meta` on the `CreditTransaction` table. All the data in the column will be lost.
  - Added the required column `description` to the `CreditTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."CreditTransaction" DROP COLUMN "meta",
ADD COLUMN     "description" TEXT NOT NULL;
