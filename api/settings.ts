import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSettings, upsertSettings } from "../src/lib/queries.js";
import { AppSettingsSchema } from "../src/lib/schemas.js";
import { requireAdmin } from "./_lib/auth.js";

/**
 * GET /api/settings → singleton settings
 * PUT /api/settings → upsert settings
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "GET") {
    // Read allowed for any authenticated admin (requireAdmin throws → 401)
    try {
      await requireAdmin(req, res);
    } catch {
      return;
    }
    const settings = await getSettings();
    return res.status(200).json(settings);
  }

  if (req.method === "PUT") {
    try {
      await requireAdmin(req, res);
    } catch {
      return;
    }
    const parsed = AppSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid settings data", details: parsed.error.flatten() });
    }
    const saved = await upsertSettings(parsed.data);
    return res.status(200).json(saved);
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Method Not Allowed" });
}
