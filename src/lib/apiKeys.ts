/**
 * Server-side API key CRUD (session-admin only via handlers).
 */
import { prisma } from "./db.js";
import {
  generateApiKey,
  parseScopes,
  parseOrigins,
  normalizeScopes,
  normalizeOrigins,
  API_SCOPES,
  MAX_ACTIVE_API_KEYS,
  type ApiScope,
} from "../../api/_lib/apiKey.js";

export {
  API_SCOPES,
  MAX_ACTIVE_API_KEYS,
  type ApiScope,
};

export type ApiKeyPublic = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  allowedOrigins: string[];
  createdBy: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function toPublic(row: {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: unknown;
  allowedOrigins?: unknown;
  createdBy: string | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): ApiKeyPublic {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: parseScopes(row.scopes),
    allowedOrigins: parseOrigins(row.allowedOrigins),
    createdBy: row.createdBy,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function sanitizeName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 80);
}

export async function listApiKeys(includeRevoked = false): Promise<ApiKeyPublic[]> {
  const rows = await prisma.apiKey.findMany({
    where: includeRevoked ? undefined : { revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map(toPublic);
}

export async function countActiveApiKeys(): Promise<number> {
  return prisma.apiKey.count({ where: { revokedAt: null } });
}

export async function createApiKey(input: {
  name: string;
  scopes?: string[];
  allowedOrigins?: string[];
  createdBy?: string | null;
  expiresAt?: Date | null;
}): Promise<{ key: string; record: ApiKeyPublic }> {
  const name = sanitizeName(input.name);
  if (!name) throw new Error("Nama API key wajib diisi");

  const scopes = normalizeScopes(input.scopes);
  if (!scopes.length) throw new Error("Minimal satu scope valid");

  const allowedOrigins = normalizeOrigins(input.allowedOrigins);

  const active = await countActiveApiKeys();
  if (active >= MAX_ACTIVE_API_KEYS) {
    throw new Error(
      `Maksimal ${MAX_ACTIVE_API_KEYS} API key aktif. Cabut key lama dulu.`,
    );
  }

  let expiresAt = input.expiresAt ?? null;
  if (expiresAt) {
    const t = expiresAt.getTime();
    if (!Number.isFinite(t) || t <= Date.now()) {
      throw new Error("Tanggal kadaluarsa harus di masa depan");
    }
    const maxMs = Date.now() + 3650 * 24 * 60 * 60 * 1000;
    if (t > maxMs) expiresAt = new Date(maxMs);
  }

  const { key, hash, prefix } = generateApiKey();
  const row = await prisma.apiKey.create({
    data: {
      name,
      keyPrefix: prefix,
      keyHash: hash,
      scopes: scopes as never,
      allowedOrigins: allowedOrigins as never,
      createdBy: input.createdBy ?? null,
      expiresAt,
    },
  });

  return { key, record: toPublic(row) };
}

export async function revokeApiKey(id: string): Promise<ApiKeyPublic | null> {
  const existing = await prisma.apiKey.findUnique({ where: { id } });
  if (!existing) return null;
  if (existing.revokedAt) return toPublic(existing);
  const row = await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
  });
  return toPublic(row);
}
