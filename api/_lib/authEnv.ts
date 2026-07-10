/**
 * Pure env helpers for auth — no Prisma / Vercel types so unit tests stay light.
 */

/**
 * Resolve AUTH_SECRET. In production, missing/short secrets throw immediately
 * (no hardcoded fallback — that would allow session forgery).
 * In development, a fixed local-only secret is used so `npm run dev` works.
 */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;

  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is required in production (min 16 characters). Generate: openssl rand -base64 32",
    );
  }

  return "dev_only_secret_not_for_production_use";
}

export function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.trim().toLowerCase());
}
