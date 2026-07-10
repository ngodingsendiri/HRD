import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSettings, upsertSettings, type SettingsInclude } from "../src/lib/queries.js";
import { AppSettingsSchema } from "../src/lib/schemas.js";
import { requireAdmin, requireStaff } from "./_lib/session.js";
import { writeAuditLog } from "../src/lib/audit.js";
import {
  MAX_LOGO_BASE64_CHARS,
  ensureRequestId,
  sendError,
  withErrorBoundary,
} from "./_lib/http.js";

/**
 * GET /api/settings?include=core,logo,kamus,peta|all
 *   Default include=all (backward compatible for full Settings page).
 *   Use include=core,kamus for lighter payloads.
 * PUT /api/settings → upsert (merged with existing so partial updates safe)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = ensureRequestId(req, res);

  return withErrorBoundary(res, "settings", async () => {
    if (req.method === "GET") {
      try {
        await requireStaff(req, res);
      } catch {
        return;
      }
      const raw = typeof req.query.include === "string" ? req.query.include : "all";
      const include = raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean) as SettingsInclude[];

      const allowed = new Set(["core", "logo", "kamus", "peta", "all"]);
      const filtered = include.filter((x) => allowed.has(x)) as SettingsInclude[];
      const settings = await getSettings({
        include: filtered.length ? filtered : ["all"],
      });
      return res.status(200).json(settings);
    }

    let admin;
    try {
      admin = await requireAdmin(req, res);
    } catch {
      return;
    }

    if (req.method === "PUT") {
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
      await writeAuditLog({
        actor: admin,
        action: "settings.update",
        entityType: "settings",
        entityId: "app",
        meta: {
          requestId,
          keys: Object.keys(parsed.data),
          hasLogo: Boolean(parsed.data.logoBase64),
        },
      });
      return res.status(200).json(saved);
    }

    res.setHeader("Allow", "GET, PUT");
    return sendError(res, 405, "Method Not Allowed");
  });
}
