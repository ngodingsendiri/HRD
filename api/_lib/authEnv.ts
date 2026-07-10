/**
 * Pure env helpers for auth — no Prisma / Vercel types so unit tests stay light.
 */

export type UserRole = "ADMIN" | "VIEWER";

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

/** Bootstrap allowlist (env) — always treated as full ADMIN. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.trim().toLowerCase());
}

/**
 * Fail-closed: only explicit ADMIN gets write.
 * Unknown / empty / typo roles become VIEWER (never auto-elevate).
 */
export function normalizeRole(raw: string | null | undefined): UserRole {
  const r = String(raw || "").toUpperCase().trim();
  if (r === "ADMIN" || r === "WRITE") return "ADMIN";
  return "VIEWER";
}

/**
 * Effective access for a user row + email.
 * - ADMIN_EMAILS → ADMIN (write)
 * - DB role VIEWER → read-only
 * - DB role ADMIN → write
 */
export function resolveAccess(
  email: string | null | undefined,
  dbRole: string | null | undefined,
): { allowed: boolean; role: UserRole; canWrite: boolean } {
  if (!email) return { allowed: false, role: "VIEWER", canWrite: false };
  if (isAdminEmail(email)) {
    return { allowed: true, role: "ADMIN", canWrite: true };
  }
  const role = normalizeRole(dbRole);
  // Without allowlist match, only known roles from DB may log in.
  return { allowed: true, role, canWrite: role === "ADMIN" };
}
