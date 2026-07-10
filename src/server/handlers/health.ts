import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pingDatabase } from "../../lib/db.js";

/**
 * GET /api/health
 * Liveness + DB probe + config flags (no secrets leaked).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const db = await pingDatabase();
  const authSecretSet = Boolean(
    process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16,
  );
  const body = {
    status: db.ok && authSecretSet ? "ok" : "degraded",
    db: db.ok ? "up" : "down",
    latencyMs: db.latencyMs,
    authSecret: authSecretSet ? "set" : "missing",
    api: "index",
    time: new Date().toISOString(),
    ...(db.ok ? {} : { error: "database_unreachable" }),
    ...(!authSecretSet && process.env.VERCEL
      ? { hint: "Set AUTH_SECRET in Vercel env (min 16 chars) and Redeploy" }
      : {}),
  };

  res.setHeader("Cache-Control", "no-store");
  // Health stays 200 if process is up; degraded fields tell the story
  return res.status(200).json(body);
}
