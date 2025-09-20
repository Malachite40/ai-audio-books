/*
  Warnings:

  - The primary key for the `Emails` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Emails` table. All the data in the column will be lost.
  - Made the column `group` on table `Emails` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."Emails_email_group_key";

-- AlterTable
ALTER TABLE "public"."Emails" DROP CONSTRAINT "Emails_pkey",
DROP COLUMN "id",
ALTER COLUMN "group" SET NOT NULL,
ADD CONSTRAINT "Emails_pkey" PRIMARY KEY ("email", "group");
