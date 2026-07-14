import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * GET /api/v1/openapi — minimal OpenAPI 3 document for external integrators.
 * Public (no auth) so tools can discover the surface; data endpoints still need keys.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const publicUrl = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:5173";
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const base = publicUrl || `${proto}://${host}`;

  const doc = {
    openapi: "3.0.3",
    info: {
      title: "HRD ASN External API",
      version: "1.0.0",
      description:
        "Read-only API for integrating HRD ASN employee data into other apps. Authenticate with an API key created in Pengaturan → API.",
    },
    servers: [{ url: base }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "API key: hrc_…",
        },
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
      },
    },
    security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    paths: {
      "/api/v1/employees": {
        get: {
          summary: "List employees",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string" } },
            { name: "bidang", in: "query", schema: { type: "string" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
            { name: "lean", in: "query", schema: { type: "boolean", default: true } },
          ],
          responses: {
            "200": {
              description: "{ data, total, limit, offset }",
            },
            "401": { description: "Invalid API key" },
          },
        },
      },
      "/api/v1/employees/{id}": {
        get: {
          summary: "Get one employee",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Employee object" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/stats": {
        get: {
          summary: "Dashboard stats (totals, bidang, KP/KGB/pensiun timelines)",
          responses: { "200": { description: "DashboardStats" } },
        },
      },
      "/api/v1/settings": {
        get: {
          summary: "App settings (core by default)",
          parameters: [
            {
              name: "include",
              in: "query",
              schema: {
                type: "string",
                default: "core",
                description: "core,logo,kamus,peta,all (comma-separated)",
              },
            },
          ],
          responses: {
            "200": { description: "AppSettings subset" },
            "401": { description: "Invalid API key" },
            "403": { description: "Missing settings:read scope" },
          },
        },
      },
      "/api/health": {
        get: {
          summary: "Health + DB ping (no auth)",
          security: [],
          responses: { "200": { description: "ok" } },
        },
      },
    },
  };

  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(200).json(doc);
}
