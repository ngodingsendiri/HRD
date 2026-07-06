import { PrismaClient } from "@prisma/client";

/**
 * Prisma singleton.
 * In development, Vite's HMR + serverless can create many PrismaClient
 * instances which exhaust DB connections. We stash one on globalThis.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
