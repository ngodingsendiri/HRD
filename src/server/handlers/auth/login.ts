import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/db.js";
import { createSession, resolveAccess } from "../../../../api/_lib/session.js";
import { writeAuditLog } from "../../../lib/audit.js";
import {
  clientIp,
  ensureRequestId,
  isProductionRuntime,
  rateLimit,
  sendError,
  withErrorBoundary,
} from "../../../../api/_lib/http.js";

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Keep this path lean: in-memory rate limit (no extra DB table), clear step errors.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method Not Allowed");
  }

  return withErrorBoundary(res, "login", async () => {
    const requestId = ensureRequestId(req, res);
    const ip = clientIp(req);

    // In-memory only — avoids failing login when rate_limit_buckets missing / Prisma lag
    const limited = rateLimit(`login:${ip}`, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!limited.ok) {
      res.setHeader("Retry-After", String(limited.retryAfterSec));
      return sendError(res, 429, "Terlalu banyak percobaan login. Coba lagi nanti.");
    }

    let body: Record<string, unknown> = {};
    if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
      body = req.body as Record<string, unknown>;
    } else if (typeof req.body === "string") {
      try {
        body = JSON.parse(req.body || "{}") as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return sendError(res, 400, "Email dan password wajib diisi");
    }

    const emailLimited = rateLimit(`login-email:${email}`, {
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
    if (!emailLimited.ok) {
      res.setHeader("Retry-After", String(emailLimited.retryAfterSec));
      return sendError(res, 429, "Terlalu banyak percobaan login. Coba lagi nanti.");
    }

    if (!process.env.DATABASE_URL?.trim()) {
      return sendError(
        res,
        503,
        "DATABASE_URL belum di-set di Vercel. Isi Environment Variables → Redeploy.",
        { code: "LOGIN_DB_URL_MISSING" },
      );
    }

    let user;
    try {
      user = await prisma.user.findUnique({ where: { email } });
    } catch (err) {
      console.error("[login] db findUnique", err);
      const detail = err instanceof Error ? err.message.slice(0, 160) : "";
      return sendError(
        res,
        503,
        "Database tidak tersedia. Periksa konfigurasi server atau coba lagi sebentar.",
        {
          code: "LOGIN_DB",
          ...(!isProductionRuntime()
            ? { detail: detail.replace(/:[^:@/]+@/g, ":***@") }
            : {}),
        },
      );
    }

    const dummyHash =
      "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    const passwordHash = user?.password ?? dummyHash;
    let isValid = false;
    try {
      isValid = await bcrypt.compare(password, passwordHash);
    } catch (err) {
      console.error("[login] bcrypt", err);
      isValid = false;
    }

    if (!user || !user.password || !isValid) {
      return sendError(res, 401, "Email atau password salah");
    }

    const access = resolveAccess(user.email, (user as { role?: string }).role);
    if (!access.allowed) {
      return sendError(res, 403, "Akun tidak memiliki akses");
    }

    try {
      await createSession(res, user.id);
    } catch (err) {
      console.error("[login] createSession", err);
      const msg = err instanceof Error ? err.message : "";
      if (/AUTH_SECRET/i.test(msg)) {
        return sendError(
          res,
          503,
          "AUTH_SECRET belum di-set di Vercel (min 16 karakter). Set env → Redeploy.",
          { code: "LOGIN_AUTH_SECRET" },
        );
      }
      return sendError(res, 500, "Gagal membuat sesi login.", {
        code: "LOGIN_SESSION",
        ...(!isProductionRuntime()
          ? { detail: msg.slice(0, 120) }
          : {}),
      });
    }

    // Best-effort audit — never fail login
    void writeAuditLog({
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
