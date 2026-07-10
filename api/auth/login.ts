import type { VercelRequest, VercelResponse } from "@vercel/node";
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/db.js";
import { createSession, isAdminEmail } from "../_lib/session.js";
import { clientIp, rateLimit, sendError, withErrorBoundary } from "../_lib/http.js";

/**
 * POST /api/auth/login
 * Body: { "email": string, "password": string }
 *
 * Verifies credentials against the `users` table (bcrypt-hashed passwords),
 * enforces ADMIN_EMAILS allowlist, and creates a DB-backed session.
 *
 * Responses:
 *   200 { user: { id, email, name, image } }
 *   400 { error: "Email dan password wajib diisi" }
 *   401 { error: "Email atau password salah" }
 *   403 { error: "Akun tidak memiliki akses admin" }
 *   429 { error: "Terlalu banyak percobaan..." }
 *   500 { error: "Terjadi kesalahan internal" }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendError(res, 405, "Method Not Allowed");
  }

  return withErrorBoundary(res, "login", async () => {
    const ip = clientIp(req);
    const limited = rateLimit(`login:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!limited.ok) {
      res.setHeader("Retry-After", String(limited.retryAfterSec));
      return sendError(res, 429, "Terlalu banyak percobaan login. Coba lagi nanti.");
    }

    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return sendError(res, 400, "Email dan password wajib diisi");
    }

    // Also rate-limit by email to slow targeted guessing.
    const emailLimited = rateLimit(`login-email:${email}`, {
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!emailLimited.ok) {
      res.setHeader("Retry-After", String(emailLimited.retryAfterSec));
      return sendError(res, 429, "Terlalu banyak percobaan login. Coba lagi nanti.");
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Use a dummy hash compare to keep timing roughly constant when the user
    // does not exist, so attackers cannot enumerate accounts via timing.
    const dummyHash = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.5gQJ0m3Nk2oQ8q5r6o1m2n3o4p5q";
    const passwordHash = user?.password ?? dummyHash;
    const isValid = await bcrypt.compare(password, passwordHash);

    if (!user || !user.password || !isValid) {
      return sendError(res, 401, "Email atau password salah");
    }

    // Enforce allowlist at login so non-admins never receive a session cookie.
    if (!isAdminEmail(user.email)) {
      return sendError(res, 403, "Akun tidak memiliki akses admin");
    }

    await createSession(res, user.id);

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    });
  });
}
