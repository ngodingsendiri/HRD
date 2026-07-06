/**
 * Seed the singleton settings with defaults. Run after prisma migrate.
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_KAMUS } from "../src/constants";

const prisma = new PrismaClient();

async function main() {
  await prisma.settings.upsert({
    where: { id: "app" },
    create: {
      id: "app",
      data: {
        sekdaNama: "",
        sekdaNip: "",
        bupatiNama: "",
        kopLine1: "PEMERINTAH KABUPATEN",
        kopLine2: "DINAS KOMUNIKASI DAN INFORMATIKA",
        kopLine3: "",
        kopLine4: "",
        logoBase64: "",
        jabatanKamusCsv: DEFAULT_KAMUS,
        petaJabatanCsv: "",
      },
    },
    update: {},
  });
  console.log("✓ Settings seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
