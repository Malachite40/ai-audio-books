/*
  Warnings:

  - A unique constraint covering the columns `[email,group]` on the table `Emails` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Emails_email_group_key" ON "public"."Emails"("email", "group");
