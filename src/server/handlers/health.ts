import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pingDatabase } from "../../lib/db.js";

/**
 * GET /api/health
 * Liveness + DB connectivity probe (no auth).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const db = await pingDatabase();
  const body = {
    status: db.ok ? "ok" : "degraded",
    db: db.ok ? "up" : "down",
    latencyMs: db.latencyMs,
    time: new Date().toISOString(),
    ...(db.ok ? {} : { error: "database_unreachable" }),
  };

  res.setHeader("Cache-Control", "no-store");
  return res.status(db.ok ? 200 : 503).json(body);
}
