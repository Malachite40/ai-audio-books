-- CreateEnum
CREATE TYPE "ReviewRating" AS ENUM ('POSITIVE', 'NEGATIVE', 'UNRATED');

-- AlterTable
ALTER TABLE "RedditPost" ADD COLUMN     "rating" "ReviewRating" NOT NULL DEFAULT 'UNRATED';
