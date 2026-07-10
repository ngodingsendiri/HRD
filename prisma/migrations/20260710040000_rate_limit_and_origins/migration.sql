-- AlterTable: API key browser origin binding
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "allowedOrigins" JSONB NOT NULL DEFAULT '[]';

-- CreateTable: distributed rate limit
CREATE TABLE IF NOT EXISTS "rate_limit_buckets" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rate_limit_buckets_resetAt_idx" ON "rate_limit_buckets"("resetAt");
