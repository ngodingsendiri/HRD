import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin } from "../_lib/session.js";
import { createApiKey, listApiKeys } from "../../src/lib/apiKeys.js";
import {
  API_SCOPES,
  MAX_EXPIRES_DAYS,
  MIN_EXPIRES_DAYS,
} from "../_lib/apiKey.js";
import { writeAuditLog } from "../../src/lib/audit.js";
import {
  clientIp,
  ensureRequestId,
  sendError,
  withErrorBoundary,
} from "../_lib/http.js";
import { rateLimitDb } from "../_lib/rateLimitDb.js";

/**
 * Manage API keys (session admin only — not API-key authenticated).
 *
 * GET  /api/v1/keys  → list keys (no secrets)
 * POST /api/v1/keys  → create { name, scopes?, expiresInDays? }
 *                      returns { key, record } — key shown once
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = ensureRequestId(req, res);

  return withErrorBoundary(res, "v1/keys", async () => {
    res.setHeader("Cache-Control", "private, no-store");

    let admin;
    try {
      admin = await requireAdmin(req, res);
    } catch {
      return;
    }

    if (req.method === "GET") {
      const includeRevoked =
        req.query.includeRevoked === "1" || req.query.includeRevoked === "true";
      const keys = await listApiKeys(includeRevoked);
      return res.status(200).json({
        keys,
        scopes: API_SCOPES,
      });
    }

    if (req.method === "POST") {
      const limited = await rateLimitDb(
        `apikey-create:${admin.id || admin.email || clientIp(req)}`,
        { limit: 20, windowMs: 60 * 60 * 1000 },
      );
      if (!limited.ok) {
        res.setHeader("Retry-After", String(limited.retryAfterSec));
        return sendError(res, 429, "Terlalu banyak membuat API key. Coba lagi nanti.");
      }

      const name = typeof req.body?.name === "string" ? req.body.name : "";
      const scopes = Array.isArray(req.body?.scopes)
        ? (req.body.scopes as unknown[]).map(String)
        : undefined;
      const allowedOrigins = Array.isArray(req.body?.allowedOrigins)
        ? (req.body.allowedOrigins as unknown[]).map(String)
        : typeof req.body?.allowedOrigins === "string"
          ? req.body.allowedOrigins.split(/[\n,]+/).map((s: string) => s.trim())
          : undefined;
      const days =
        typeof req.body?.expiresInDays === "number"
          ? req.body.expiresInDays
          : typeof req.body?.expiresInDays === "string"
            ? parseInt(req.body.expiresInDays, 10)
            : NaN;

      let expiresAt: Date | null = null;
      if (Number.isFinite(days) && days > 0) {
        const clamped = Math.min(
          Math.max(Math.floor(days), MIN_EXPIRES_DAYS),
          MAX_EXPIRES_DAYS,
        );
        expiresAt = new Date(Date.now() + clamped * 24 * 60 * 60 * 1000);
      }

      try {
        const { key, record } = await createApiKey({
          name,
          scopes,
          allowedOrigins,
          createdBy: admin.email ?? admin.id ?? null,
          expiresAt,
        });
        await writeAuditLog({
          actor: admin,
          action: "api_key.create",
          entityType: "system",
          entityId: record.id,
          meta: {
            requestId,
            name: record.name,
            scopes: record.scopes,
          },
        });
        return res.status(201).json({
          key,
          record,
          warning:
            "Simpan API key ini sekarang. Secret tidak bisa dilihat lagi setelah dialog ditutup.",
        });
      } catch (e) {
        return sendError(
          res,
          400,
          e instanceof Error ? e.message : "Gagal membuat API key",
        );
      }
    }

    res.setHeader("Allow", "GET, POST");
    return sendError(res, 405, "Method Not Allowed");
  });
}
