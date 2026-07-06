import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getServerSession } from "./auth-config";

/**
 * Allowlist of GitHub user IDs permitted to use the admin app.
 * Set via ADMIN_GITHUB_IDS env var (comma-separated), e.g.:
 *   ADMIN_GITHUB_IDS=12345,67890
 *
 * This replaces the hardcoded emails in firestore.rules. Configure your own
 * GitHub account ID (https://api.github.com/user while logged in) and any
 * co-admins in Vercel env vars — never in source.
 */
function adminGithubIds(): Set<string> {
  const raw = process.env.ADMIN_GITHUB_IDS || "";
  return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
}

export interface AdminUser {
  githubId: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * Throws if the request is not from an authenticated admin. The caller is
 * expected to `try { await requireAdmin(...) } catch { return; }` because
 * requireAdmin writes the 401 response itself.
 */
export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<AdminUser> {
  const session = await getServerSession(req, res);
  const githubId = (session as { user?: { id?: string } } | null)?.user?.id;

  if (!session || !githubId || !adminGithubIds().has(githubId)) {
    res.status(401).json({ error: "Unauthorized" });
    throw new Error("Unauthorized");
  }

  const u = (session as { user: AdminUser }).user;
  return { githubId: u.githubId, name: u.name, email: u.email, image: u.image };
}
