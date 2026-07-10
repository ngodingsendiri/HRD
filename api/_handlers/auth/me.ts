import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSession } from "../../_lib/session.js";
import { sendError, withErrorBoundary } from "../../_lib/http.js";

/**
 * GET /api/auth/me → { user } | { user: null }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method Not Allowed");
  }

  return withErrorBoundary(res, "me", async () => {
    const session = await getSession(req);
    if (!session?.user) {
      return res.status(200).json({ user: null });
    }
    return res.status(200).json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        role: session.user.role,
        canWrite: session.user.canWrite,
      },
    });
  });
}
