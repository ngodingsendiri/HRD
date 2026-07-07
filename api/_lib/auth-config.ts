import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Auth, type AuthConfig } from "@auth/core";
import Credentials from "@auth/core/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "../../src/lib/db.js";
import bcrypt from "bcryptjs";

/**
 * Auth.js configuration, serverless-friendly.
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

export const authOptions: AuthConfig = {
  secret: process.env.AUTH_SECRET || "fallback_secret_hrcube_dev_only_9999",
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  basePath: "/api/auth",
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

// ─── Vercel Node.js adapter ──────────────────────────────────────────────────
// Auth.js expects Web API `Request` / `Response`, but Vercel
// Node.js serverless functions use Node.js `IncomingMessage` / `ServerResponse`.
// We bridge the two with lightweight adapters below.

/**
 * Read the raw, unparsed request body from a Vercel Node.js IncomingMessage.
 *
 * @vercel/node auto-parses JSON / form-urlencoded bodies into `req.body`, but
 * that parsing is fragile: it can be skipped depending on content-type
 * negotiation, and re-serializing a parsed object can corrupt values that
 * contain special characters (e.g. `+`, `%`). Auth.js's credentials callback
 * reads the POST body itself from the Web `Request`, so we must give it the
 * verbatim bytes the client sent. This drains any pre-parsed body first and
 * falls back to reading the raw stream.
 */
function readRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Convert a Node.js IncomingMessage (VercelRequest) into a Web API Request.
 * Reads the body into the Request init so Auth.js can parse form/json payloads.
 */
async function vercelRequestToWebRequest(req: VercelRequest): Promise<Request> {
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

  // Remove hop-by-hop / computed headers BEFORE setting the body. The Web
  // `Request` constructor recomputes Content-Length from the actual body bytes;
  // leaving a stale value (pointing at the original, possibly larger request)
  // causes Auth.js to read a truncated body and fail CSRF / credential checks.
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  let body: BodyInit | undefined;

  // Auth.js credentials callback expects the raw form-urlencoded POST body.
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
      // Vercel left the body as a raw string/buffer — use verbatim.
      body = typeof req.body === "string" ? req.body : req.body.toString("utf8");
    } else if (req.body && typeof req.body === "object") {
      // Vercel parsed the body into an object. Re-serialize to form-urlencoded.
      // Use URLSearchParams directly so values are correctly percent-encoded
      // (handles `+`, `%`, unicode, and repeated/array keys).
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(req.body)) {
        if (Array.isArray(value)) {
          for (const item of value) params.append(key, String(item ?? ""));
        } else {
          params.append(key, String(value ?? ""));
        }
      }
      body = params.toString();
    } else {
      // Body wasn't pre-parsed — drain the raw stream as a last resort.
      body = await readRawBody(req);
    }
  }

  return new Request(url, {
    method: req.method || "GET",
    headers,
    body,
    // @ts-expect-error - duplex is required by undici when a body is provided
    // but is missing from the lib.dom typings used here.
    duplex: "half",
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
  try {
    const webReq = await vercelRequestToWebRequest(req);
    const webRes = await Auth(webReq, authOptions);
    nextResponseToVercel(webRes, res);
  } catch (error: any) {
    console.error("Auth GET Error:", error);
    res.status(500).json({ error: error?.message || "Internal Auth Error" });
  }
}

/** Vercel-compatible POST handler for /api/auth/[...auth] */
export async function authPost(req: VercelRequest, res: VercelResponse) {
  try {
    const webReq = await vercelRequestToWebRequest(req);
    const webRes = await Auth(webReq, authOptions);
    nextResponseToVercel(webRes, res);
  } catch (error: any) {
    console.error("Auth POST Error:", error);
    res.status(500).json({ error: error?.message || "Internal Auth Error" });
  }
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
 * Fetch the current session by calling the internal Auth handler
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
    const webRes = await Auth(webReq, authOptions);
    if (!webRes.ok) return null;
    const data = await webRes.json();
    return data && Object.keys(data).length > 0 ? (data as SessionPayload) : null;
  } catch {
    return null;
  }
}
