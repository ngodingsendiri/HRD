import type { VercelRequest, VercelResponse } from "@vercel/node";
import NextAuth, { type NextAuthConfig } from "next-auth";
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

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
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
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
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
        (session.user as { id?: string; email?: string }).id = token.id as string;
        (session.user as { id?: string; email?: string }).email = token.email as string;
      }
      return session;
    },
  },
  // Trust host is required for Vercel/preview deployments.
  trustHost: true,
};

/** NextAuth v5 result — provides handlers and auth helper. */
const nextAuthResult = NextAuth(authOptions);

// ─── Vercel Node.js adapter ──────────────────────────────────────────────────
// NextAuth v5 handlers expect Web API `NextRequest` / `Response`, but Vercel
// Node.js serverless functions use Node.js `IncomingMessage` / `ServerResponse`.
// We bridge the two with lightweight adapters below.

/**
 * Convert a Node.js IncomingMessage (VercelRequest) into a Web API Request.
 * Reads the body into the Request init so NextAuth can parse form/json payloads.
 */
function vercelRequestToWebRequest(req: VercelRequest): Request {
  const url = `https://${req.headers.host || "localhost"}${req.url || "/"}`;
  const headers = new Headers();

  // Copy relevant headers
  const raw = req.headers as Record<string, string | string[] | undefined>;
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    }
  }

  let body: BodyInit | undefined;

  // Extract body — Vercel parses JSON/form body into req.body, but NextAuth
  // credentials callback reads form-encoded POST body from the Request.
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    if (typeof req.body === "string") {
      body = req.body;
    } else if (req.body && typeof req.body === "object") {
      // If Vercel parsed the body as an object, serialize it as form-encoded
      // (NextAuth credentials expects application/x-www-form-urlencoded).
      body = new URLSearchParams(
        Object.entries(req.body).map(([k, v]) => [k, String(v ?? "")]),
      ).toString();
    }
  }

  return new Request(url, {
    method: req.method || "GET",
    headers,
    body,
  });
}

/**
 * Pipe a Web API Response into a VercelResponse (Node.js ServerResponse).
 */
function nextResponseToVercel(webRes: Response, res: VercelResponse): void {
  res.status(webRes.status);

  webRes.headers.forEach((value, key) => {
    // Skip transfer-encoding to avoid double-chunking
    if (key.toLowerCase() !== "transfer-encoding") {
      res.setHeader(key, value);
    }
  });

  // Stream the body
  const reader = webRes.body?.getReader();
  if (reader) {
    const pump = () => {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            res.end();
          } else {
            res.write(value);
            pump();
          }
        })
        .catch(() => {
          res.end();
        });
    };
    pump();
  } else {
    res.end();
  }
}

// ─── Exported Vercel handlers ──────────────────────────────────────────────────

/** Vercel-compatible GET handler for /api/auth/[...auth] */
export async function authGet(req: VercelRequest, res: VercelResponse) {
  const webReq = vercelRequestToWebRequest(req);
  // NextAuth v5 handlers type-expect NextRequest; Web Request is structurally
  // compatible at runtime. Cast via unknown to satisfy the type checker.
  const webRes = await nextAuthResult.handlers.GET(webReq as never);
  nextResponseToVercel(webRes, res);
}

/** Vercel-compatible POST handler for /api/auth/[...auth] */
export async function authPost(req: VercelRequest, res: VercelResponse) {
  const webReq = vercelRequestToWebRequest(req);
  const webRes = await nextAuthResult.handlers.POST(webReq as never);
  nextResponseToVercel(webRes, res);
}

// ─── Session helper for requireAdmin ─────────────────────────────────────────

interface SessionPayload {
  user?: {
    id?: string;
    email?: string;
    name?: string | null;
    image?: string | null;
  } | null;
}

/**
 * Fetch the current session by calling the internal NextAuth handler
 * via a synthetic GET /api/auth/session request.
 */
export async function getServerSession(
  req: VercelRequest,
  _res: VercelResponse,
): Promise<SessionPayload | null> {
  // Build a fake request that points to /api/auth/session
  const baseUrl = `https://${req.headers.host || "localhost"}`;
  const cookieHeader = (req.headers.cookie as string | undefined) || "";

  const sessionUrl = `${baseUrl}/api/auth/session`;
  const webReq = new Request(sessionUrl, {
    headers: new Headers({ cookie: cookieHeader }),
  });

  try {
    const webRes = await nextAuthResult.handlers.GET(webReq as never);
    if (!webRes.ok) return null;
    return (await webRes.json()) as SessionPayload;
  } catch {
    return null;
  }
}
