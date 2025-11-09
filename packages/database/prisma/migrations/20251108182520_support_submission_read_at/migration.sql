-- Add readAt column to SupportSubmission
ALTER TABLE "public"."SupportSubmission"
ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMPTZ;

-- Optional index to speed up unread counts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'SupportSubmission_readAt_idx'
  ) THEN
    CREATE INDEX "SupportSubmission_readAt_idx" ON "public"."SupportSubmission"("readAt");
  END IF;
END $$;

