import type { VercelRequest, VercelResponse } from "@vercel/node";
import { pingDatabase } from "../../lib/db.js";
import { isProductionRuntime } from "../../../api/_lib/http.js";

/**
 * GET /api/health
 * JSON only — used to verify API routing + DB + AUTH_SECRET (no secrets leaked).
 * Production omits raw dbError text (may contain hostnames).
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
  const databaseUrlSet = Boolean(process.env.DATABASE_URL?.trim());
  const prod = isProductionRuntime();

  const body = {
    status: db.ok && authSecretSet && databaseUrlSet ? "ok" : "degraded",
    db: db.ok ? "up" : "down",
    latencyMs: db.latencyMs,
    databaseUrl: databaseUrlSet ? "set" : "missing",
    authSecret: authSecretSet ? "set" : "missing",
    api: "index",
    time: new Date().toISOString(),
    ...(!prod && db.error ? { dbError: db.error } : {}),
    hints: [
      !databaseUrlSet
        ? "Set DATABASE_URL (Neon pooler) in Vercel Production env"
        : null,
      !authSecretSet
        ? "Set AUTH_SECRET (min 16 chars) in Vercel Production env"
        : null,
      !db.ok && databaseUrlSet
        ? "DB URL set but connect failed — check pooler URL, sslmode=require, redeploy"
        : null,
    ].filter(Boolean),
  };

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(200).json(body);
}
