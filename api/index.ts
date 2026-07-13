/**
 * Single Vercel Serverless Function for entire /api/* surface.
 *
 * vercel.json: /api/(.*) → /api/index?path=$1
 * Handlers: src/server/handlers/** (static imports so NFT bundles them)
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
import employeeById from "../src/server/handlers/employees/byId.js";
import v1Openapi from "../src/server/handlers/v1/openapi.js";
import v1Stats from "../src/server/handlers/v1/stats.js";
import v1Settings from "../src/server/handlers/v1/settings.js";
import v1Employees from "../src/server/handlers/v1/employees.js";
import v1EmployeeById from "../src/server/handlers/v1/employees/byId.js";
import v1Keys from "../src/server/handlers/v1/keys.js";
import v1KeyById from "../src/server/handlers/v1/keys/byId.js";

type Handler = (
  req: VercelRequest,
  res: VercelResponse,
) => unknown | Promise<unknown>;

function asHandler(mod: unknown, name: string): Handler {
  if (typeof mod === "function") return mod as Handler;
  const d = (mod as { default?: unknown } | null)?.default;
  if (typeof d === "function") return d as Handler;
  throw new Error(`Handler export invalid: ${name}`);
}

const H = {
  login: asHandler(login, "login"),
  logout: asHandler(logout, "logout"),
  me: asHandler(me, "me"),
  register: asHandler(register, "register"),
  health: asHandler(health, "health"),
  stats: asHandler(stats, "stats"),
  settings: asHandler(settings, "settings"),
  employees: asHandler(employees, "employees"),
  employeeById: asHandler(employeeById, "employeeById"),
  v1Openapi: asHandler(v1Openapi, "v1Openapi"),
  v1Stats: asHandler(v1Stats, "v1Stats"),
  v1Settings: asHandler(v1Settings, "v1Settings"),
  v1Employees: asHandler(v1Employees, "v1Employees"),
  v1EmployeeById: asHandler(v1EmployeeById, "v1EmployeeById"),
  v1Keys: asHandler(v1Keys, "v1Keys"),
  v1KeyById: asHandler(v1KeyById, "v1KeyById"),
};

type Route =
  | { kind: "exact"; path: string; handler: Handler }
  | {
      kind: "param";
      pattern: RegExp;
      params: string[];
      handler: Handler;
    };

const routes: Route[] = [
  { kind: "exact", path: "auth/login", handler: H.login },
  { kind: "exact", path: "auth/logout", handler: H.logout },
  { kind: "exact", path: "auth/me", handler: H.me },
  { kind: "exact", path: "auth/register", handler: H.register },
  { kind: "exact", path: "health", handler: H.health },
  { kind: "exact", path: "stats", handler: H.stats },
  { kind: "exact", path: "settings", handler: H.settings },
  { kind: "exact", path: "employees", handler: H.employees },
  {
    kind: "param",
    pattern: /^employees\/([^/]+)$/,
    params: ["id"],
    handler: H.employeeById,
  },
  { kind: "exact", path: "v1/openapi", handler: H.v1Openapi },
  { kind: "exact", path: "v1/stats", handler: H.v1Stats },
  { kind: "exact", path: "v1/settings", handler: H.v1Settings },
  { kind: "exact", path: "v1/employees", handler: H.v1Employees },
  {
    kind: "param",
    pattern: /^v1\/employees\/([^/]+)$/,
    params: ["id"],
    handler: H.v1EmployeeById,
  },
  { kind: "exact", path: "v1/keys", handler: H.v1Keys },
  {
    kind: "param",
    pattern: /^v1\/keys\/([^/]+)$/,
    params: ["id"],
    handler: H.v1KeyById,
  },
];

function ensureJsonBody(req: VercelRequest): void {
  if (req.body == null) return;
  if (typeof req.body === "string") {
    try {
      req.body = JSON.parse(req.body || "{}");
    } catch {
      req.body = {};
    }
  }
  // Sometimes body is a Buffer
  if (Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString("utf8") || "{}");
    } catch {
      req.body = {};
    }
  }
}

export function resolveApiPath(req: VercelRequest): string {
  // Prefer rewrite query: /api/index?path=auth/login
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
    // /api/index → empty path (no route); /api/auth/login if not rewritten
    if (p === "/api/index" || p === "/api/index/") p = "";
    if (p.startsWith("/api/")) p = p.slice(5);
    else if (p.startsWith("api/")) p = p.slice(4);
    else if (p === "/api") p = "";
    // strip leading index/
    if (p.startsWith("index/")) p = p.slice(6);
    if (p === "index") p = "";
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
    const msg = err instanceof Error ? err.message : String(err);
    if (/AUTH_SECRET/i.test(msg)) {
      res.status(503).json({
        error:
          "AUTH_SECRET belum di-set di Vercel (min 16 karakter). Set env → Redeploy.",
        code: "AUTH_SECRET",
      });
      return;
    }
    // Production: generic message only (constitution P4 / T7). Dev: short detail for debug.
    const isProd =
      process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production";
    res.status(500).json({
      error: "Terjadi kesalahan internal",
      code: "API_UNCAUGHT",
      ...(!isProd
        ? {
            route: pathname,
            detail: msg.replace(/[A-Za-z0-9+/]{20,}/g, "[redacted]").slice(0, 160),
          }
        : {}),
    });
  }
}
