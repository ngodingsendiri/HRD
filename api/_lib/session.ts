import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../../src/lib/db.js";
import { getAuthSecret, isAdminEmail } from "./authEnv.js";

export { getAuthSecret, isAdminEmail, adminEmails } from "./authEnv.js";

/**
 * Custom session-based authentication for Vercel Node.js serverless.
 *
 * Why not @auth/core / next-auth?
 *   Those libs target the Web API (Request/Response). Vercel Node runtime uses
 *   Node's IncomingMessage/ServerResponse, so a bridge is required — and that
 *   bridge is fragile (content-length mismatches, redirect-following, 404s on
 *   POST). This module speaks Node's API natively and returns plain JSON, which
 *   is far more predictable in serverless.
 *
 * Session model:
 *   - Cookie holds an opaque selector + verifier (like Paseto/OWASP pattern).
 *   - DB stores the SHA-256 hash of the verifier, never the raw token.
 *   - Expiry: 7 days, persisted across browser restarts (Max-Age cookie).
 *
 * Env:
 *   AUTH_SECRET   — 32+ char random string used to HMAC-sign the cookie value
 *                   so it cannot be forged. Generate: openssl rand -base64 32
 *   ADMIN_EMAILS  — comma-separated allowlist of admin emails
 */

const COOKIE_NAME = "hrcube_session";
const SESSION_MAX_AGE_DAYS = 7;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

// ─── Cookie value format: selector.hmac(verifier) ────────────────────────────
// The cookie carries the raw verifier, but signed with AUTH_SECRET so the
// server can detect tampering without a DB lookup. The DB stores only the
// SHA-256 hash of the verifier, so a DB leak does not expose live sessions.

function sign(verifier: string): string {
  return createHmac("sha256", getAuthSecret()).update(verifier).digest("hex");
}

function hashToken(verifier: string): string {
  // Store a hash of the verifier, not the verifier itself.
  return createHmac("sha256", getAuthSecret() + "::token").update(verifier).digest("hex");
}

function generateToken(): { verifier: string; cookieValue: string; dbHash: string } {
  // 32 random bytes → 64 hex chars. Split into selector (16 bytes / 32 hex)
  // and verifier (16 bytes / 32 hex) for the split-token pattern.
  const bytes = randomBytes(32);
  const selector = bytes.subarray(0, 16).toString("hex");
  const verifier = bytes.subarray(16).toString("hex");
  const cookieValue = `${selector}.${sign(verifier)}.${verifier}`;
  return { verifier, cookieValue, dbHash: hashToken(verifier) };
}

function parseCookieValue(cookieValue: string): { selector: string; verifier: string } | null {
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return null;
  const [selector, signature, verifier] = parts;
  if (!selector || !signature || !verifier) return null;

  // Verify the HMAC signature to detect tampering before hitting the DB.
  const expected = sign(verifier);
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  return { selector, verifier };
}

function readCookie(req: VercelRequest): string | undefined {
  const cookieHeader = (req.headers.cookie as string | undefined) || "";
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === COOKIE_NAME) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

function isSecureContext(): boolean {
  // Set Secure cookie only on HTTPS (production). Vercel terminates TLS at the
  // edge, so req.socket.encrypted is unreliable; NODE_ENV is the safer signal.
  return process.env.NODE_ENV === "production";
}

function setSessionCookie(res: VercelResponse, cookieValue: string): void {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_MS / 1000}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isSecureContext()) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res: VercelResponse): void {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isSecureContext()) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

// ─── Public session API ──────────────────────────────────────────────────────

export interface SessionPayload {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
  sessionToken: string;
}

/**
 * Create a new session for a user and set the session cookie on the response.
 * Returns the raw cookie value (rarely needed by callers).
 */
export async function createSession(
  res: VercelResponse,
  userId: string,
): Promise<{ cookieValue: string }> {
  const { cookieValue, dbHash } = generateToken();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);

  // Use the first 32 hex chars of the verifier hash as the `sessionToken`
  // unique key in the DB (it is itself unique by construction).
  await prisma.session.create({
    data: {
      sessionToken: dbHash,
      userId,
      expires,
    },
  });

  setSessionCookie(res, cookieValue);
  return { cookieValue };
}

/**
 * Resolve the current session from the request cookie. Returns null if there
 * is no cookie, the signature is invalid, the session has expired, or the user
 * no longer exists. Expired sessions are cleaned up lazily.
 */
export async function getSession(req: VercelRequest): Promise<SessionPayload | null> {
  const cookieValue = readCookie(req);
  if (!cookieValue) return null;

  const parsed = parseCookieValue(cookieValue);
  if (!parsed) return null;
  const { verifier } = parsed;
  const dbHash = hashToken(verifier);

  const session = await prisma.session.findUnique({
    where: { sessionToken: dbHash },
    include: { user: true },
  });

  if (!session) return null;

  // Expired — delete and treat as no session.
  if (session.expires.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    sessionToken: session.sessionToken,
    user: {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name,
      image: session.user.image,
    },
  };
}

/**
 * Destroy the current session (DB row + cookie). Safe to call when there is no
 * active session.
 */
export async function destroySession(req: VercelRequest, res: VercelResponse): Promise<void> {
  const cookieValue = readCookie(req);
  if (cookieValue) {
    const parsed = parseCookieValue(cookieValue);
    if (parsed) {
      const dbHash = hashToken(parsed.verifier);
      await prisma.session.delete({ where: { sessionToken: dbHash } }).catch(() => {});
    }
  }
  clearSessionCookie(res);
}

// ─── Admin guard ─────────────────────────────────────────────────────────────

export interface AdminUser {
  id?: string;
  name?: string | null;
  email?: string;
  image?: string | null;
}

/**
 * Throws if the request is not from an authenticated admin. The caller is
 * expected to `try { await requireAdmin(...) } catch { return; }` because
 * requireAdmin writes the 401 response itself.
 *
 * Signature preserved from the old Auth.js implementation so existing data
 * handlers (employees, settings) need no changes.
 */
export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<AdminUser> {
  const session = await getSession(req);
  const email = session?.user?.email;

  if (!session || !email || !isAdminEmail(email)) {
    res.status(401).json({ error: "Unauthorized: Email not registered as admin" });
    throw new Error("Unauthorized");
  }

  const u = session.user;
  return { id: u.id, name: u.name, email: u.email, image: u.image };
}
