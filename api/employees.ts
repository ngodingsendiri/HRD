import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getEmployees,
  createEmployee,
  deleteEmployees,
  bulkUpsertEmployees,
  findEmployeeIdByNipOrNik,
} from "../src/lib/queries.js";
import { EmployeeSchema } from "../src/lib/schemas.js";
import { requireAdmin } from "./_lib/auth.js";
import {
  MAX_BULK_DELETE_IDS,
  MAX_BULK_EMPLOYEES,
  MAX_EMPLOYEES_PAGE,
  sendError,
  withErrorBoundary,
} from "./_lib/http.js";

/**
 * GET    /api/employees         → list (optional ?q=&limit=&offset=)
 * POST   /api/employees         → create
 * DELETE /api/employees         → bulk delete { ids: string[] }
 * PUT    /api/employees         → bulk-upsert { action, employees }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return withErrorBoundary(res, "employees", async () => {
    try {
      await requireAdmin(req, res);
    } catch {
      return;
    }

    if (req.method === "GET") {
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : NaN;
      const offsetRaw = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : NaN;
      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), MAX_EMPLOYEES_PAGE)
        : MAX_EMPLOYEES_PAGE;
      const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

      const rows = await getEmployees(undefined, { q, limit, offset });
      return res.status(200).json(rows);
    }

    if (req.method === "POST") {
      const parsed = EmployeeSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "Data pegawai tidak valid", {
          details: parsed.error.flatten(),
        });
      }

      const dup = await findEmployeeIdByNipOrNik(parsed.data.nip, parsed.data.nik);
      if (dup) {
        return sendError(res, 409, "NIP atau NIK sudah terdaftar");
      }

      const created = await createEmployee(parsed.data);
      return res.status(201).json(created);
    }

    if (req.method === "DELETE") {
      const ids = (req.body?.ids ?? []) as string[];
      if (!Array.isArray(ids) || ids.length === 0) {
        return sendError(res, 400, "ids array required");
      }
      if (ids.length > MAX_BULK_DELETE_IDS) {
        return sendError(res, 400, `Maksimal ${MAX_BULK_DELETE_IDS} id per permintaan`);
      }
      if (!ids.every((id) => typeof id === "string" && id.length > 0 && id.length < 64)) {
        return sendError(res, 400, "Format ids tidak valid");
      }
      await deleteEmployees(ids);
      return res.status(204).end();
    }

    if (req.method === "PUT" && req.body?.action === "bulk-upsert") {
      const incoming = (req.body.employees ?? []) as Record<string, unknown>[];
      if (!Array.isArray(incoming)) {
        return sendError(res, 400, "employees array required");
      }
      if (incoming.length > MAX_BULK_EMPLOYEES) {
        return sendError(res, 400, `Maksimal ${MAX_BULK_EMPLOYEES} baris per impor`);
      }
      const result = await bulkUpsertEmployees(incoming);
      return res.status(200).json(result);
    }

    res.setHeader("Allow", "GET, POST, DELETE, PUT");
    return sendError(res, 405, "Method Not Allowed");
  });
}
