-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "employees" (
    "id" TEXT NOT NULL,
    "nik" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "nip" TEXT NOT NULL,
    "jk" VARCHAR(2) NOT NULL,
    "tempatLahir" TEXT NOT NULL,
    "tanggalLahir" TEXT NOT NULL,
    "jalanDusun" TEXT NOT NULL,
    "rt" TEXT NOT NULL,
    "rw" TEXT NOT NULL,
    "desaKelurahan" TEXT NOT NULL,
    "kecamatan" TEXT NOT NULL,
    "kabupaten" TEXT NOT NULL,
    "jabatan" TEXT NOT NULL,
    "bidang" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tmtKerja" TEXT NOT NULL,
    "pangkat" TEXT NOT NULL,
    "gol" TEXT NOT NULL,
    "pangkatGolongan" TEXT NOT NULL,
    "tmtGolonganRuang" TEXT NOT NULL,
    "masaKerjaGolonganRuang" TEXT NOT NULL,
    "tanggalBerkalaTerakhir" TEXT NOT NULL,
    "gajiPokok" TEXT NOT NULL,
    "besaranGajiKotor" TEXT NOT NULL,
    "digajiMenurut" TEXT NOT NULL,
    "noRekeningBank" TEXT NOT NULL,
    "npwp" TEXT NOT NULL,
    "nomorKarpeg" TEXT NOT NULL,
    "pendidikan" TEXT NOT NULL,
    "jurusan" TEXT NOT NULL,
    "diklatJenjang" TEXT NOT NULL,
    "tahunDiklat" TEXT NOT NULL,
    "statusKawin" TEXT NOT NULL,
    "agama" TEXT NOT NULL,
    "nomorHp" TEXT NOT NULL,
    "sisaCutiN" TEXT NOT NULL,
    "sisaCutiN1" TEXT NOT NULL,
    "sisaCutiN2" TEXT NOT NULL,
    "skTerakhir" TEXT NOT NULL,
    "jumlahTertanggung" INTEGER NOT NULL DEFAULT 0,
    "dataKeluarga" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "settings" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- Indexes (IF NOT EXISTS for idempotent apply on existing DBs)
CREATE INDEX IF NOT EXISTS "employees_nip_idx" ON "employees"("nip");
CREATE INDEX IF NOT EXISTS "employees_nik_idx" ON "employees"("nik");
CREATE INDEX IF NOT EXISTS "employees_status_idx" ON "employees"("status");
CREATE INDEX IF NOT EXISTS "employees_bidang_idx" ON "employees"("bidang");

-- Partial unique: non-empty NIP/NIK must be unique (empty allowed for incomplete rows)
CREATE UNIQUE INDEX IF NOT EXISTS "employees_nip_nonempty_unique"
  ON "employees" ("nip") WHERE "nip" <> '';
CREATE UNIQUE INDEX IF NOT EXISTS "employees_nik_nonempty_unique"
  ON "employees" ("nik") WHERE "nik" <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_sessionToken_key" ON "sessions"("sessionToken");
CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_token_key" ON "verification_tokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- FKs (ignore if already present)
DO $$ BEGIN
  ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
