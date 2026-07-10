/**
 * Create or update an admin user.
 *
 * Credentials MUST come from environment variables (never hardcoded):
 *   ADMIN_EMAIL     — required
 *   ADMIN_PASSWORD  — required (min 8 characters)
 *   ADMIN_NAME      — optional display name (default: "Admin")
 *
 * Example:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='your-strong-password' npx tsx scripts/create-admin.ts
 */
import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = (process.env.ADMIN_NAME || "Admin").trim() || "Admin";

  if (!email || !email.includes("@")) {
    console.error("❌ Set ADMIN_EMAIL to a valid email address.");
    console.error(
      "   Example: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='...' npx tsx scripts/create-admin.ts",
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("❌ Set ADMIN_PASSWORD (minimum 8 characters).");
    process.exit(1);
  }

  const allowlist = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length > 0 && !allowlist.includes(email)) {
    console.warn(
      "⚠️  ADMIN_EMAIL is not listed in ADMIN_EMAILS. Login will succeed only if this email is added to ADMIN_EMAILS.",
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, name },
    });
    console.log("✅ Updated password for user:", email);
  } else {
    await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
      },
    });
    console.log("✅ Created user:", email);
  }

  console.log("   Remember to set ADMIN_EMAILS to include this email in production.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
