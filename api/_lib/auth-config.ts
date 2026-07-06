import type { VercelRequest, VercelResponse } from "@vercel/node";
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "../../src/lib/db";

/**
 * Auth.js (NextAuth v5) configuration, serverless-friendly.
 * Uses the Prisma adapter to persist users/sessions/accounts in Neon.
 *
 * Provider: GitHub (chosen to align with the GitHub-centric workflow).
 *
 * Env vars required (set in Vercel dashboard):
 *   AUTH_GITHUB_ID, AUTH_GITHUB_SECRET
 *   AUTH_SECRET  (generate: openssl rand -base64 32)
 *   AUTH_TRUST_HOST=true
 *   DATABASE_URL, DIRECT_URL  (Neon)
 *   ADMIN_GITHUB_IDS=12345,67890
 */
export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" as const },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    /**
     * Persist the GitHub numeric user id on the JWT so requireAdmin() can
     * match it against ADMIN_GITHUB_IDS. This is the modern replacement for
     * the hardcoded-email allowlist in firestore.rules.
     */
    async jwt({ token, profile }) {
      if (profile && "id" in profile) {
        token.githubId = String((profile as { id: number }).id);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.githubId) {
        (session.user as { id?: string }).id = token.githubId as string;
      }
      return session;
    },
  },
  // Trust host is required for Vercel/preview deployments.
  trustHost: true,
};

export const Auth = NextAuth(authOptions);

/** Convenience wrapper used by requireAdmin. */
export async function getServerSession(req: VercelRequest, res: VercelResponse) {
  return Auth(req as unknown as Request, res as unknown as Response);
}
