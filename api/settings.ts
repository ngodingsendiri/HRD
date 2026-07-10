import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSettings, upsertSettings } from "../src/lib/queries.js";
import { AppSettingsSchema } from "../src/lib/schemas.js";
import { requireAdmin } from "./_lib/auth.js";
import { MAX_LOGO_BASE64_CHARS, sendError, withErrorBoundary } from "./_lib/http.js";

/**
 * GET /api/settings → singleton settings
 * PUT /api/settings → upsert settings
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return withErrorBoundary(res, "settings", async () => {
    if (req.method === "GET") {
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
        return sendError(res, 400, "Data pengaturan tidak valid", {
          details: parsed.error.flatten(),
        });
      }

      if (
        parsed.data.logoBase64 &&
        parsed.data.logoBase64.length > MAX_LOGO_BASE64_CHARS
      ) {
        return sendError(res, 400, "Ukuran logo terlalu besar (maks ~1MB)");
      }

      const saved = await upsertSettings(parsed.data);
      return res.status(200).json(saved);
    }

    res.setHeader("Allow", "GET, PUT");
    return sendError(res, 405, "Method Not Allowed");
  });
}
