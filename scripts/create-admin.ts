import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const email = "ngerjaindiri@gmail.com";
  const password = "sekretariat";

  const hashedPassword = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });
    console.log("✅ Berhasil update password untuk user:", email);
  } else {
    await prisma.user.create({
      data: {
        email,
        name: "Admin Sekretariat",
        password: hashedPassword,
      },
    });
    console.log("✅ Berhasil membuat user baru:", email);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
