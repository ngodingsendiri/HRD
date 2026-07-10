import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db.js";
import { createSession, resolveAccess } from "../_lib/session.js";
import { writeAuditLog } from "../../src/lib/audit.js";
import {
  clientIp,
  ensureRequestId,
  sendError,
  withErrorBoundary,
} from "../_lib/http.js";
import { rateLimitDb } from "../_lib/rateLimitDb.js";

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Access:
 *   - Valid credentials in `users`
 *   - role ADMIN | VIEWER (default ADMIN), or email on ADMIN_EMAILS
 * Write (canWrite): role ADMIN or ADMIN_EMAILS allowlist
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method Not Allowed");
  }

  return withErrorBoundary(res, "login", async () => {
    const requestId = ensureRequestId(req, res);
    const ip = clientIp(req);
    // Distributed (Neon) — works across Vercel isolates
    const limited = await rateLimitDb(`login:${ip}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!limited.ok) {
      res.setHeader("Retry-After", String(limited.retryAfterSec));
      return sendError(res, 429, "Terlalu banyak percobaan login. Coba lagi nanti.");
    }

    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return sendError(res, 400, "Email dan password wajib diisi");
    }

    const emailLimited = await rateLimitDb(`login-email:${email}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!emailLimited.ok) {
      res.setHeader("Retry-After", String(emailLimited.retryAfterSec));
      return sendError(res, 429, "Terlalu banyak percobaan login. Coba lagi nanti.");
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Valid bcrypt hash of a random string — keeps compare timing similar when user missing
    const dummyHash =
      "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    const passwordHash = user?.password ?? dummyHash;
    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, passwordHash);
    } catch {
      isValid = false;
    }

    if (!user || !user.password || !isValid) {
      return sendError(res, 401, "Email atau password salah");
    }

    const access = resolveAccess(user.email, (user as { role?: string }).role);
    if (!access.allowed) {
      return sendError(res, 403, "Akun tidak memiliki akses");
    }

    await createSession(res, user.id);
    await writeAuditLog({
      actor: { id: user.id, email: user.email },
      action: "auth.login",
      entityType: "session",
      entityId: user.id,
      meta: { requestId, ip, role: access.role },
    });

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: access.role,
        canWrite: access.canWrite,
      },
    });
  });
}
