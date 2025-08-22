-- AlterTable
ALTER TABLE "Speaker" ALTER COLUMN "gptCondLatent" DROP NOT NULL,
ALTER COLUMN "speakerEmbedding" DROP NOT NULL;
