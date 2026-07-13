-- Optional domain overrides for predictive HR fields (stored; derived still preferred when empty)
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "bupTanggal" TEXT NOT NULL DEFAULT '';
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "tmtKp" TEXT NOT NULL DEFAULT '';
