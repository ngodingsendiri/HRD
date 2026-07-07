import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Registration endpoint — DISABLED.
 * User creation is handled exclusively via `scripts/create-admin.ts`.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(403).json({ error: "Registrasi dinonaktifkan. Hubungi administrator." });
}

