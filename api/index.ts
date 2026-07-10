/**
 * Single Vercel Serverless Function for the entire /api/* surface.
 *
 * Hobby plan max = 12 functions. Vite + Vercel does NOT support Next-style
 * catch-all files (`[...path].ts`) the same way — nested /api/auth/login 404s.
 *
 * Fix: one entry `api/index.ts` + vercel.json rewrite:
 *   /api/(.*) → /api
 * Path is parsed from req.url and dispatched to api/_handlers/**.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

type Handler = (
  req: VercelRequest,
  res: VercelResponse,
) => unknown | Promise<unknown>;

type Route =
  | { kind: "exact"; path: string; load: () => Promise<{ default: Handler }> }
  | {
      kind: "param";
      pattern: RegExp;
      params: string[];
      load: () => Promise<{ default: Handler }>;
    };

const routes: Route[] = [
  {
    kind: "exact",
    path: "auth/login",
    load: () => import("./_handlers/auth/login.js"),
  },
  {
    kind: "exact",
    path: "auth/logout",
    load: () => import("./_handlers/auth/logout.js"),
  },
  {
    kind: "exact",
    path: "auth/me",
    load: () => import("./_handlers/auth/me.js"),
  },
  {
    kind: "exact",
    path: "auth/register",
    load: () => import("./_handlers/auth/register.js"),
  },
  {
    kind: "exact",
    path: "health",
    load: () => import("./_handlers/health.js"),
  },
  {
    kind: "exact",
    path: "stats",
    load: () => import("./_handlers/stats.js"),
  },
  {
    kind: "exact",
    path: "settings",
    load: () => import("./_handlers/settings.js"),
  },
  {
    kind: "exact",
    path: "employees",
    load: () => import("./_handlers/employees.js"),
  },
  {
    kind: "param",
    pattern: /^employees\/([^/]+)$/,
    params: ["id"],
    load: () => import("./_handlers/employees/[id].js"),
  },
  {
    kind: "exact",
    path: "v1/openapi",
    load: () => import("./_handlers/v1/openapi.js"),
  },
  {
    kind: "exact",
    path: "v1/stats",
    load: () => import("./_handlers/v1/stats.js"),
  },
  {
    kind: "exact",
    path: "v1/settings",
    load: () => import("./_handlers/v1/settings.js"),
  },
  {
    kind: "exact",
    path: "v1/employees",
    load: () => import("./_handlers/v1/employees.js"),
  },
  {
    kind: "param",
    pattern: /^v1\/employees\/([^/]+)$/,
    params: ["id"],
    load: () => import("./_handlers/v1/employees/[id].js"),
  },
  {
    kind: "exact",
    path: "v1/keys",
    load: () => import("./_handlers/v1/keys.js"),
  },
  {
    kind: "param",
    pattern: /^v1\/keys\/([^/]+)$/,
    params: ["id"],
    load: () => import("./_handlers/v1/keys/[id].js"),
  },
];

/** Extract path after /api/ from the original request URL. */
export function resolveApiPath(req: VercelRequest): string {
  // 1) x-vercel-forwarded or original URL on req
  const raw =
    (typeof req.url === "string" && req.url) ||
    (typeof req.headers["x-invoke-path"] === "string" &&
      req.headers["x-invoke-path"]) ||
    "";

  // 2) When rewritten to /api, Vercel often keeps original in x-forwarded-uri / x-matched-path
  const forwarded =
    (typeof req.headers["x-forwarded-uri"] === "string" &&
      req.headers["x-forwarded-uri"]) ||
    (typeof req.headers["x-vercel-forwarded-path"] === "string" &&
      req.headers["x-vercel-forwarded-path"]) ||
    "";

  let candidate = raw || forwarded || "";

  // Strip query string
  const q = candidate.indexOf("?");
  if (q >= 0) candidate = candidate.slice(0, q);

  // Also try query param if rewrite passes it: /api?path=auth/login
  if (typeof req.query.path === "string" && req.query.path) {
    return String(req.query.path).replace(/^\/+|\/+$/g, "");
  }
  if (Array.isArray(req.query.path) && req.query.path.length) {
    return req.query.path.map(String).filter(Boolean).join("/");
  }

  try {
    // req.url may be absolute path "/api/auth/login" or "/api" after rewrite
    const host = String(req.headers.host || "localhost");
    const url = new URL(candidate || raw || "/api", `https://${host}`);
    let p = url.pathname || "";

    // After rewrite dest=/api, pathname may be just "/api" — recover from referer? No.
    // Use rewrite destination with capture: /api?__path=:path
    if (p === "/api" || p === "/api/") {
      // Check custom query from rewrite
      const pathQ =
        url.searchParams.get("path") ||
        (typeof req.query.__path === "string" ? req.query.__path : null);
      if (pathQ) return pathQ.replace(/^\/+|\/+$/g, "");
    }

    if (p.startsWith("/api/")) p = p.slice(5);
    else if (p.startsWith("api/")) p = p.slice(4);
    else if (p === "/api") p = "";
    return p.replace(/^\/+|\/+$/g, "");
  } catch {
    return "";
  }
}

export function matchRoute(pathname: string): {
  load: Route["load"];
  params: Record<string, string>;
} | null {
  const path = pathname.replace(/^\/+|\/+$/g, "");

  for (const r of routes) {
    if (r.kind === "exact" && r.path === path) {
      return { load: r.load, params: {} };
    }
    if (r.kind === "param") {
      const m = path.match(r.pattern);
      if (m) {
        const params: Record<string, string> = {};
        r.params.forEach((key, i) => {
          params[key] = decodeURIComponent(m[i + 1] || "");
        });
        return { load: r.load, params };
      }
    }
  }
  return null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Authorization, X-API-Key, Content-Type, Accept",
    );
    res.status(204).end();
    return;
  }

  const pathname = resolveApiPath(req);
  const matched = matchRoute(pathname);

  if (!matched) {
    res.status(404).json({
      error: "Not Found",
      path: pathname ? `/api/${pathname}` : "/api",
      hint: "API is consolidated in api/index.ts — check rewrite /api/(.*) → /api",
    });
    return;
  }

  for (const [k, v] of Object.entries(matched.params)) {
    (req.query as Record<string, string | string[] | undefined>)[k] = v;
  }

  try {
    const mod = await matched.load();
    await mod.default(req, res);
  } catch (err) {
    if (res.headersSent) return;
    console.error("[api]", pathname, err);
    res.status(500).json({ error: "Terjadi kesalahan internal" });
  }
}
