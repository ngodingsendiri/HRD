import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin } from "../../../../../api/_lib/session.js";
import { revokeApiKey } from "../../../../lib/apiKeys.js";
import { pathParamId } from "../../../../../api/_lib/apiKey.js";
import { writeAuditLog } from "../../../../lib/audit.js";
import {
  ensureRequestId,
  sendError,
  withErrorBoundary,
} from "../../../../../api/_lib/http.js";

/**
 * DELETE /api/v1/keys/:id — revoke API key (session admin).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = ensureRequestId(req, res);

  return withErrorBoundary(res, "v1/keys/[id]", async () => {
    res.setHeader("Cache-Control", "private, no-store");

    let admin;
    try {
      admin = await requireAdmin(req, res);
    } catch {
      return;
    }

    const id = pathParamId(req.query.id as string | string[] | undefined);
    if (!id) return sendError(res, 400, "id required");

    if (req.method === "DELETE") {
      const record = await revokeApiKey(id);
      if (!record) return sendError(res, 404, "API key not found");
      // Already revoked — still 200 idempotent
      await writeAuditLog({
        actor: admin,
        action: "api_key.revoke",
        entityType: "system",
        entityId: id,
        meta: {
          requestId,
          name: record.name,
          alreadyRevoked: Boolean(record.revokedAt),
        },
      });
      return res.status(200).json({ ok: true, record });
    }

    res.setHeader("Allow", "DELETE");
    return sendError(res, 405, "Method Not Allowed");
  });
}
