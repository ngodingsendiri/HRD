import { prisma } from "../src/lib/db";

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" TEXT;`);
    console.log("✅ Berhasil menambahkan kolom password ke tabel users tanpa menghapus tabel lain.");
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
