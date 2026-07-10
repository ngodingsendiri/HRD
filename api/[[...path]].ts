/**
 * Single Vercel Serverless Function for the entire /api/* surface.
 *
 * Hobby plan allows max 12 functions — consolidating all routes here keeps
 * us at 1 function while preserving existing URL paths for the SPA client
 * and external integrators.
 *
 * Handlers live in api/_handlers/** (private; not deployed as separate functions).
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
      /** e.g. ^employees/([^/]+)$ */
      pattern: RegExp;
      /** query keys assigned from capture groups */
      params: string[];
      load: () => Promise<{ default: Handler }>;
    };

const routes: Route[] = [
  // Auth
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

  // Core app
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

  // External API v1
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

function resolvePath(req: VercelRequest): string {
  // Prefer catch-all query (Vercel sets this for [[...path]])
  const q = req.query.path;
  if (Array.isArray(q) && q.length) {
    return q.map(String).filter(Boolean).join("/");
  }
  if (typeof q === "string" && q.length) {
    return q.replace(/^\/+|\/+$/g, "");
  }

  // Fallback: parse URL (vercel dev / edge cases)
  try {
    const host = String(req.headers.host || "localhost");
    const url = new URL(req.url || "/", `http://${host}`);
    let p = url.pathname || "";
    if (p.startsWith("/api/")) p = p.slice(5);
    else if (p === "/api") p = "";
    return p.replace(/^\/+|\/+$/g, "");
  } catch {
    return "";
  }
}

function matchRoute(pathname: string): {
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
  // CORS preflight for any path — individual handlers may refine
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

  const pathname = resolvePath(req);
  const matched = matchRoute(pathname);

  if (!matched) {
    res.status(404).json({
      error: "Not Found",
      path: pathname ? `/api/${pathname}` : "/api",
    });
    return;
  }

  // Merge dynamic params into req.query (handlers read req.query.id etc.)
  for (const [k, v] of Object.entries(matched.params)) {
    (req.query as Record<string, string | string[] | undefined>)[k] = v;
  }

  try {
    const mod = await matched.load();
    await mod.default(req, res);
  } catch (err) {
    if (res.headersSent) return;
    console.error("[api catch-all]", pathname, err);
    res.status(500).json({ error: "Terjadi kesalahan internal" });
  }
}
