/**
 * API key auth for /api/v1/* public integrations.
 *
 * Clients send:
 *   Authorization: Bearer hrc_…
 *   or X-API-Key: hrc_…
 *
 * Only SHA-256 hashes are stored in DB.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../../src/lib/db.js";

export const API_SCOPES = [
  "employees:read",
  "stats:read",
  "settings:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

/** Max active (non-revoked) keys per deployment — prevents abuse. */
export const MAX_ACTIVE_API_KEYS = 25;
/** Max length of presented secret (DoS guard before hashing). */
export const MAX_API_KEY_LENGTH = 200;
/** Min/max expiry window when creating a key. */
export const MIN_EXPIRES_DAYS = 1;
export const MAX_EXPIRES_DAYS = 3650;
/** Throttle lastUsedAt writes to reduce Neon write amplification. */
const LAST_USED_THROTTLE_MS = 5 * 60 * 1000;

export interface ApiKeyPrincipal {
  id: string;
  name: string;
  scopes: string[];
  keyPrefix: string;
  /** Empty = any origin allowed */
  allowedOrigins: string[];
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("base64url");
  const key = `hrc_${raw}`;
  const hash = hashApiKey(key);
  const prefix = key.slice(0, 12);
  return { key, hash, prefix };
}

export function parseScopes(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.map(String);
    } catch {
      return raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return ["employees:read", "stats:read"];
}

/** Parse allowedOrigins JSON; empty = unrestricted. */
export function parseOrigins(raw: unknown): string[] {
  let list: string[] = [];
  if (Array.isArray(raw)) list = raw.map(String);
  else if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) list = p.map(String);
      else
        list = raw
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
    } catch {
      list = raw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return normalizeOrigins(list);
}

/** Keep only absolute http(s) origins, max 20. */
export function normalizeOrigins(input?: string[] | null): string[] {
  if (!input?.length) return [];
  const out: string[] = [];
  for (const raw of input) {
    const s = String(raw).trim().replace(/\/$/, "");
    if (!s) continue;
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      const origin = u.origin;
      if (!out.includes(origin) && out.length < 20) out.push(origin);
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

/** Keep only known scopes; no wildcard `*` (least privilege). */
export function normalizeScopes(input?: string[] | null): ApiScope[] {
  const source =
    input?.length && input.length > 0
      ? input
      : (["employees:read", "stats:read"] as string[]);
  const out: ApiScope[] = [];
  for (const s of source) {
    if (API_SCOPES.includes(s as ApiScope) && !out.includes(s as ApiScope)) {
      out.push(s as ApiScope);
    }
  }
  return out;
}

function extractKey(req: VercelRequest): string | null {
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const x = req.headers["x-api-key"];
  if (typeof x === "string" && x.trim()) return x.trim();
  if (Array.isArray(x) && x[0]) return String(x[0]).trim();
  return null;
}

function isPlausibleKey(plaintext: string): boolean {
  if (!plaintext.startsWith("hrc_")) return false;
  if (plaintext.length < 20 || plaintext.length > MAX_API_KEY_LENGTH) return false;
  if (!/^hrc_[A-Za-z0-9_-]+$/.test(plaintext)) return false;
  return true;
}

/** Request Origin for browser CORS binding (null for server-to-server). */
export function requestOrigin(req: VercelRequest): string | null {
  const o = req.headers.origin;
  if (typeof o === "string" && o.trim()) {
    try {
      return new URL(o.trim()).origin;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * If key has allowedOrigins and request has Origin, Origin must match.
 * Server-to-server (no Origin) always passes.
 */
export function originAllowed(
  principal: ApiKeyPrincipal,
  origin: string | null,
): boolean {
  if (!principal.allowedOrigins.length) return true;
  if (!origin) return true; // non-browser client
  return principal.allowedOrigins.includes(origin);
}

export async function resolveApiKey(req: VercelRequest): Promise<ApiKeyPrincipal | null> {
  const plaintext = extractKey(req);
  if (!plaintext || !isPlausibleKey(plaintext)) return null;

  const hash = hashApiKey(plaintext);
  const row = await prisma.apiKey.findUnique({ where: { keyHash: hash } });
  if (!row || row.revokedAt) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;

  const principal: ApiKeyPrincipal = {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: parseScopes(row.scopes),
    allowedOrigins: parseOrigins(
      (row as { allowedOrigins?: unknown }).allowedOrigins,
    ),
  };

  const origin = requestOrigin(req);
  if (!originAllowed(principal, origin)) return null;

  const shouldStamp =
    !row.lastUsedAt ||
    Date.now() - row.lastUsedAt.getTime() >= LAST_USED_THROTTLE_MS;

  if (shouldStamp) {
    try {
      await prisma.apiKey.update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      });
    } catch {
      /* non-fatal */
    }
  }

  return principal;
}

export function hasScope(principal: ApiKeyPrincipal, scope: ApiScope): boolean {
  return principal.scopes.includes(scope);
}

/**
 * Require a valid API key with the given scope.
 * Writes 401/403 and throws on failure (caller should catch + return).
 */
export async function requireApiKey(
  req: VercelRequest,
  res: VercelResponse,
  scope: ApiScope,
): Promise<ApiKeyPrincipal> {
  const principal = await resolveApiKey(req);
  if (!principal) {
    res.status(401).json({
      error:
        "Missing or invalid API key (or Origin not allowed). Use Authorization: Bearer hrc_… or X-API-Key.",
    });
    throw new Error("Unauthorized");
  }
  if (!hasScope(principal, scope)) {
    res.status(403).json({
      error: `API key lacks scope: ${scope}`,
      required: scope,
      scopes: principal.scopes,
    });
    throw new Error("Forbidden");
  }
  return principal;
}

/** Sanitize path param id from Vercel (string | string[]). */
export function pathParamId(raw: string | string[] | undefined): string | null {
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 64);
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) {
    return raw[0].trim().slice(0, 64);
  }
  return null;
}

/** Constant-time compare for optional future use */
export function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
