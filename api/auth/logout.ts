import type { VercelRequest, VercelResponse } from "@vercel/node";
import { destroySession } from "../_lib/session.js";
import { sendError, withErrorBoundary } from "../_lib/http.js";

/**
 * POST /api/auth/logout
 *
 * Destroys the current session (DB row + cookie). Always returns 200, even if
 * there was no active session, so the client can treat logout as idempotent.
 *
 * Response: 200 { ok: true }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method Not Allowed");
  }

  return withErrorBoundary(res, "logout", async () => {
    await destroySession(req, res);
    return res.status(200).json({ ok: true });
  });
}
