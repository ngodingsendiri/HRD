import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../../src/lib/db.js";
import {
  getAuthSecret,
  isAdminEmail,
  normalizeRole,
  resolveAccess,
  type UserRole,
} from "./authEnv.js";

export {
  getAuthSecret,
  isAdminEmail,
  adminEmails,
  normalizeRole,
  resolveAccess,
  type UserRole,
} from "./authEnv.js";

/**
 * Custom session-based authentication for Vercel Node.js serverless.
 *
 * Session model:
 *   - Cookie: selector.hmac(verifier).verifier
 *   - DB stores hash of verifier only
 *   - Expiry: 7 days
 *
 * Authorization:
 *   - requireStaff: any authenticated ADMIN/VIEWER (or ADMIN_EMAILS)
 *   - requireAdmin: write access (ADMIN role or ADMIN_EMAILS)
 */

const COOKIE_NAME = "hrdasn_session";
/** Legacy brand cookie — clear on logout so rebrand does not leave orphan sessions. */
const LEGACY_COOKIE_NAMES = ["hrcube_session"] as const;
const SESSION_MAX_AGE_DAYS = 7;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

function sign(verifier: string): string {
  return createHmac("sha256", getAuthSecret()).update(verifier).digest("hex");
}

function hashToken(verifier: string): string {
  return createHmac("sha256", getAuthSecret() + "::token").update(verifier).digest("hex");
}

function generateToken(): { cookieValue: string; dbHash: string } {
  const bytes = randomBytes(32);
  const selector = bytes.subarray(0, 16).toString("hex");
  const verifier = bytes.subarray(16).toString("hex");
  const cookieValue = `${selector}.${sign(verifier)}.${verifier}`;
  return { cookieValue, dbHash: hashToken(verifier) };
}

function parseCookieValue(cookieValue: string): { verifier: string } | null {
  const parts = cookieValue.split(".");
  if (parts.length !== 3) return null;
  const [selector, signature, verifier] = parts;
  if (!selector || !signature || !verifier) return null;

  const expected = sign(verifier);
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  return { verifier };
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
  const secure = isSecureContext() ? "; Secure" : "";
  const clearOne = (name: string) =>
    `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
  const cookies = [COOKIE_NAME, ...LEGACY_COOKIE_NAMES].map(clearOne);
  res.setHeader("Set-Cookie", cookies);
}

// ─── Public session API ──────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  role: UserRole;
  canWrite: boolean;
}

export interface SessionPayload {
  user: SessionUser;
  sessionToken: string;
}

export async function createSession(
  res: VercelResponse,
  userId: string,
): Promise<{ cookieValue: string }> {
  const { cookieValue, dbHash } = generateToken();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);

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

export async function getSession(req: VercelRequest): Promise<SessionPayload | null> {
  const cookieValue = readCookie(req);
  if (!cookieValue) return null;

  const parsed = parseCookieValue(cookieValue);
  if (!parsed) return null;
  const dbHash = hashToken(parsed.verifier);

  const session = await prisma.session.findUnique({
    where: { sessionToken: dbHash },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expires.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  const email = session.user.email ?? "";
  const access = resolveAccess(email, (session.user as { role?: string }).role);

  if (!access.allowed) return null;

  return {
    sessionToken: session.sessionToken,
    user: {
      id: session.user.id,
      email,
      name: session.user.name,
      image: session.user.image,
      role: access.role,
      canWrite: access.canWrite,
    },
  };
}

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

/** Revoke every session for a user (e.g. logout all devices / password rotate). */
export async function destroyAllSessionsForUser(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}

export async function destroySessionAndMaybeAll(
  req: VercelRequest,
  res: VercelResponse,
  opts?: { allDevices?: boolean; userId?: string },
): Promise<{ revoked: number }> {
  if (opts?.allDevices && opts.userId) {
    const n = await destroyAllSessionsForUser(opts.userId);
    clearSessionCookie(res);
    return { revoked: n };
  }
  await destroySession(req, res);
  return { revoked: 1 };
}

// ─── Guards ──────────────────────────────────────────────────────────────────

export interface StaffUser {
  id?: string;
  name?: string | null;
  email?: string;
  image?: string | null;
  role: UserRole;
  canWrite: boolean;
}

/** Authenticated staff (ADMIN or VIEWER). Writes 401 and throws if not. */
export async function requireStaff(req: VercelRequest, res: VercelResponse): Promise<StaffUser> {
  const session = await getSession(req);
  if (!session?.user?.email) {
    res.status(401).json({ error: "Unauthorized" });
    throw new Error("Unauthorized");
  }
  const u = session.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: u.role,
    canWrite: u.canWrite,
  };
}

/**
 * Write-capable admin. Prefer this for mutations.
 * Still named requireAdmin for backward compatibility with existing handlers.
 */
export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<StaffUser> {
  const staff = await requireStaff(req, res);
  if (!staff.canWrite) {
    res.status(403).json({ error: "Forbidden: akses hanya baca (VIEWER)" });
    throw new Error("Forbidden");
  }
  return staff;
}
