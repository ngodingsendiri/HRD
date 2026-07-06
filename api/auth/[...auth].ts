import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authGet, authPost } from "../_lib/auth-config";

/**
 * Auth.js catch-all route handler for Vercel Node.js serverless.
 * Routes /api/auth/signin, /api/auth/signout, /api/auth/callback/credentials,
 * /api/auth/session, /api/auth/csrf, etc. through the NextAuth v5 handlers.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    return authGet(req, res);
  }
  if (req.method === "POST") {
    return authPost(req, res);
  }
  return res.status(405).json({ error: "Method Not Allowed" });
}
