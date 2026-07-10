/**
 * Create or update an admin/viewer user.
 *
 * Env (never hardcode secrets):
 *   ADMIN_EMAIL     — required
 *   ADMIN_PASSWORD  — required (min 8)
 *   ADMIN_NAME      — optional
 *   ADMIN_ROLE      — ADMIN (default) | VIEWER
 *   REVOKE_SESSIONS — "1" to wipe all sessions after password update
 *
 * Example:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='...' npm run create-admin
 */
import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = (process.env.ADMIN_NAME || "Admin").trim() || "Admin";
  const roleRaw = (process.env.ADMIN_ROLE || "ADMIN").trim().toUpperCase();
  const role = roleRaw === "VIEWER" ? "VIEWER" : "ADMIN";
  const revoke = process.env.REVOKE_SESSIONS === "1" || process.env.REVOKE_SESSIONS === "true";

  if (!email || !email.includes("@")) {
    console.error("❌ Set ADMIN_EMAIL to a valid email address.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("❌ Set ADMIN_PASSWORD (minimum 8 characters).");
    process.exit(1);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, name, role },
    });
    console.log("✅ Updated user:", email, `(role=${role})`);
  } else {
    await prisma.user.create({
      data: { email, name, password: hashedPassword, role },
    });
    console.log("✅ Created user:", email, `(role=${role})`);
  }

  if (revoke) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (u) {
      const r = await prisma.session.deleteMany({ where: { userId: u.id } });
      console.log(`✅ Revoked ${r.count} session(s).`);
    }
  }

  console.log("   Tip: ADMIN_EMAILS env still elevates allowlisted emails to write access.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
