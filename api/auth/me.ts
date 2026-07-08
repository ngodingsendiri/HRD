import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSession } from "../_lib/session.js";

/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user, or `{ user: null }` when there is
 * no active session. Never returns 401 — the client distinguishes states via
 * the `user` field, which simplifies fetch handling in the SPA.
 *
 * Response: 200 { user: { id, email, name, image } | null }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const session = await getSession(req);
    return res.status(200).json({
      user: session
        ? {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            image: session.user.image,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Session Error:", error);
    return res.status(200).json({ user: null });
  }
}
