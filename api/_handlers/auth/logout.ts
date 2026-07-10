import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  destroySession,
  destroySessionAndMaybeAll,
  getSession,
} from "../../_lib/session.js";
import { writeAuditLog } from "../../../src/lib/audit.js";
import { ensureRequestId, sendError, withErrorBoundary } from "../../_lib/http.js";

/**
 * POST /api/auth/logout
 * Body optional: { allDevices?: boolean }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method Not Allowed");
  }

  return withErrorBoundary(res, "logout", async () => {
    const requestId = ensureRequestId(req, res);
    const session = await getSession(req);
    const allDevices = Boolean(req.body?.allDevices);

    if (allDevices && session?.user?.id) {
      const { revoked } = await destroySessionAndMaybeAll(req, res, {
        allDevices: true,
        userId: session.user.id,
      });
      await writeAuditLog({
        actor: session.user,
        action: "auth.logout",
        entityType: "session",
        entityId: session.user.id,
        meta: { requestId, allDevices: true, revoked },
      });
      return res.status(200).json({ ok: true, revoked });
    }

    await destroySession(req, res);
    if (session?.user) {
      await writeAuditLog({
        actor: session.user,
        action: "auth.logout",
        entityType: "session",
        entityId: session.user.id,
        meta: { requestId, allDevices: false },
      });
    }
    return res.status(200).json({ ok: true, revoked: 1 });
  });
}
