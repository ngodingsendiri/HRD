import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getServerSession } from "./auth-config";

/**
 * Allowlist of emails permitted to use the admin app.
 * Set via ADMIN_EMAILS env var (comma-separated), e.g.:
 *   ADMIN_EMAILS=admin@example.com,hr@example.com
 */
function adminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || "";
  return new Set(raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

/**
 * Throws if the request is not from an authenticated admin. The caller is
 * expected to `try { await requireAdmin(...) } catch { return; }` because
 * requireAdmin writes the 401 response itself.
 */
export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<AdminUser> {
  const session = await getServerSession(req, res);
  const email = (session as { user?: { email?: string } } | null)?.user?.email;

  if (!session || !email || !adminEmails().has(email.toLowerCase())) {
    res.status(401).json({ error: "Unauthorized: Email not registered as admin" });
    throw new Error("Unauthorized");
  }

  const u = (session as { user: AdminUser }).user;
  return { id: u.id, name: u.name, email: u.email, image: u.image };
}
