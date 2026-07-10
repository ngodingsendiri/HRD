import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSession, isAdminEmail } from "../_lib/session.js";
import { sendError, withErrorBoundary } from "../_lib/http.js";

/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated admin user, or `{ user: null }` when
 * there is no active session / not an admin. Never returns 401 — the client
 * distinguishes states via the `user` field.
 *
 * Response: 200 { user: { id, email, name, image } | null }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method Not Allowed");
  }

  return withErrorBoundary(res, "me", async () => {
    const session = await getSession(req);
    const email = session?.user?.email;
    // Only surface users that are still on the admin allowlist.
    if (!session || !email || !isAdminEmail(email)) {
      return res.status(200).json({ user: null });
    }

    return res.status(200).json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
    });
  });
}
