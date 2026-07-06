import type { VercelRequest, VercelResponse } from "@vercel/node";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "../../src/lib/db";
import bcrypt from "bcryptjs";

/**
 * Auth.js (NextAuth v5) configuration, serverless-friendly.
 * Uses the Prisma adapter to persist users/sessions/accounts in Neon.
 *
 * Provider: Credentials (Email/Password).
 *
 * Env vars required (set in Vercel dashboard):
 *   AUTH_SECRET  (generate: openssl rand -base64 32)
 *   AUTH_TRUST_HOST=true
 *   DATABASE_URL, DIRECT_URL  (Neon)
 *   ADMIN_EMAILS=admin@example.com,hr@example.com
 */
export const authOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" as const },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email);
        const password = String(credentials.password);

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          return null; // User not found or signed up via OAuth only
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      }
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id;
        (session.user as any).email = token.email;
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
