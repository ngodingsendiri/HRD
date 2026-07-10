/**
 * Single Vercel Serverless Function for the entire /api/* surface.
 *
 * Why static imports (not dynamic import to api/_*):
 * - Vercel may not ship underscore folders as loose files
 * - Dynamic import() often fails at runtime → 500 "Terjadi kesalahan internal"
 * - Static imports guarantee the bundler includes every handler
 *
 * Routing: vercel.json rewrites /api/(.*) → /api?path=$1
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

import login from "../src/server/handlers/auth/login.js";
import logout from "../src/server/handlers/auth/logout.js";
import me from "../src/server/handlers/auth/me.js";
import register from "../src/server/handlers/auth/register.js";
import health from "../src/server/handlers/health.js";
import stats from "../src/server/handlers/stats.js";
import settings from "../src/server/handlers/settings.js";
import employees from "../src/server/handlers/employees.js";
import employeeById from "../src/server/handlers/employees/[id].js";
import v1Openapi from "../src/server/handlers/v1/openapi.js";
import v1Stats from "../src/server/handlers/v1/stats.js";
import v1Settings from "../src/server/handlers/v1/settings.js";
import v1Employees from "../src/server/handlers/v1/employees.js";
import v1EmployeeById from "../src/server/handlers/v1/employees/[id].js";
import v1Keys from "../src/server/handlers/v1/keys.js";
import v1KeyById from "../src/server/handlers/v1/keys/[id].js";

type Handler = (
  req: VercelRequest,
  res: VercelResponse,
) => unknown | Promise<unknown>;

type Route =
  | { kind: "exact"; path: string; handler: Handler }
  | {
      kind: "param";
      pattern: RegExp;
      params: string[];
      handler: Handler;
    };

const routes: Route[] = [
  { kind: "exact", path: "auth/login", handler: login },
  { kind: "exact", path: "auth/logout", handler: logout },
  { kind: "exact", path: "auth/me", handler: me },
  { kind: "exact", path: "auth/register", handler: register },
  { kind: "exact", path: "health", handler: health },
  { kind: "exact", path: "stats", handler: stats },
  { kind: "exact", path: "settings", handler: settings },
  { kind: "exact", path: "employees", handler: employees },
  {
    kind: "param",
    pattern: /^employees\/([^/]+)$/,
    params: ["id"],
    handler: employeeById,
  },
  { kind: "exact", path: "v1/openapi", handler: v1Openapi },
  { kind: "exact", path: "v1/stats", handler: v1Stats },
  { kind: "exact", path: "v1/settings", handler: v1Settings },
  { kind: "exact", path: "v1/employees", handler: v1Employees },
  {
    kind: "param",
    pattern: /^v1\/employees\/([^/]+)$/,
    params: ["id"],
    handler: v1EmployeeById,
  },
  { kind: "exact", path: "v1/keys", handler: v1Keys },
  {
    kind: "param",
    pattern: /^v1\/keys\/([^/]+)$/,
    params: ["id"],
    handler: v1KeyById,
  },
];

/** Ensure JSON body is an object (Vercel usually parses; harden for rewrites). */
function ensureJsonBody(req: VercelRequest): void {
  if (req.body == null) return;
  if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body || "{}");
    } catch {
      req.body = {};
    }
  }
}

/** Extract path after /api/ from the request (rewrite puts it in ?path=). */
export function resolveApiPath(req: VercelRequest): string {
  if (typeof req.query.path === "string" && req.query.path) {
    return String(req.query.path).replace(/^\/+|\/+$/g, "");
  }
  if (Array.isArray(req.query.path) && req.query.path.length) {
    return req.query.path.map(String).filter(Boolean).join("/");
  }

  try {
    const host = String(req.headers.host || "localhost");
    const raw = typeof req.url === "string" ? req.url : "/api";
    const url = new URL(raw, `https://${host}`);
    const pathQ = url.searchParams.get("path");
    if (pathQ) return pathQ.replace(/^\/+|\/+$/g, "");

    let p = url.pathname || "";
    if (p.startsWith("/api/")) p = p.slice(5);
    else if (p.startsWith("api/")) p = p.slice(4);
    else if (p === "/api") p = "";
    return p.replace(/^\/+|\/+$/g, "");
  } catch {
    return "";
  }
}

export function matchRoute(pathname: string): {
  handler: Handler;
  params: Record<string, string>;
} | null {
  const path = pathname.replace(/^\/+|\/+$/g, "");

  for (const r of routes) {
    if (r.kind === "exact" && r.path === path) {
      return { handler: r.handler, params: {} };
    }
    if (r.kind === "param") {
      const m = path.match(r.pattern);
      if (m) {
        const params: Record<string, string> = {};
        r.params.forEach((key, i) => {
          params[key] = decodeURIComponent(m[i + 1] || "");
        });
        return { handler: r.handler, params };
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

  ensureJsonBody(req);

  const pathname = resolveApiPath(req);
  const matched = matchRoute(pathname);

  if (!matched) {
    res.status(404).json({
      error: "Not Found",
      path: pathname ? `/api/${pathname}` : "/api",
    });
    return;
  }

  for (const [k, v] of Object.entries(matched.params)) {
    (req.query as Record<string, string | string[] | undefined>)[k] = v;
  }

  try {
    await matched.handler(req, res);
  } catch (err) {
    if (res.headersSent) return;
    console.error("[api]", pathname, err);
    const msg = err instanceof Error ? err.message : "";
    if (/AUTH_SECRET/i.test(msg)) {
      res.status(503).json({
        error:
          "Konfigurasi server belum lengkap (AUTH_SECRET). Hubungi administrator.",
      });
      return;
    }
    res.status(500).json({ error: "Terjadi kesalahan internal" });
  }
}
