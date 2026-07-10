import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getEmployeesPage,
  createEmployee,
  deleteEmployees,
  bulkUpsertEmployees,
  findEmployeeIdByNipOrNik,
} from "../../src/lib/queries.js";
import { EmployeeSchema } from "../../src/lib/schemas.js";
import { requireAdmin, requireStaff } from "../_lib/session.js";
import { writeAuditLog } from "../../src/lib/audit.js";
import {
  DEFAULT_EMPLOYEES_PAGE,
  MAX_BULK_DELETE_IDS,
  MAX_BULK_EMPLOYEES,
  MAX_EMPLOYEES_PAGE,
  ensureRequestId,
  sendError,
  withErrorBoundary,
} from "../_lib/http.js";

/**
 * GET    /api/employees  → { data, total, limit, offset }
 * POST   /api/employees  → create
 * DELETE /api/employees  → bulk delete { ids }
 * PUT    /api/employees  → bulk-upsert { action, employees }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = ensureRequestId(req, res);

  return withErrorBoundary(res, "employees", async () => {
    if (req.method === "GET") {
      try {
        await requireStaff(req, res);
      } catch {
        return;
      }
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const alertRaw = typeof req.query.alert === "string" ? req.query.alert : undefined;
      const alert =
        alertRaw === "kp" || alertRaw === "kgb" || alertRaw === "any"
          ? alertRaw
          : undefined;
      const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : NaN;
      const offsetRaw = typeof req.query.offset === "string" ? parseInt(req.query.offset, 10) : NaN;
      // lean defaults true unless lean=0
      const lean = !(req.query.lean === "0" || req.query.lean === "false");

      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), MAX_EMPLOYEES_PAGE)
        : DEFAULT_EMPLOYEES_PAGE;
      const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

      const page = await getEmployeesPage({ q, status, alert, limit, offset, lean });
      res.setHeader("x-total-count", String(page.total));
      res.setHeader("Cache-Control", "private, no-cache");
      return res.status(200).json(page);
    }

    let admin;
    try {
      admin = await requireAdmin(req, res);
    } catch {
      return;
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

      try {
        const created = await createEmployee(parsed.data);
        await writeAuditLog({
          actor: admin,
          action: "employee.create",
          entityType: "employee",
          entityId: created.id,
          meta: { nip: created.nip, nama: created.nama, requestId },
        });
        return res.status(201).json(created);
      } catch (err) {
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          return sendError(res, 409, "NIP atau NIK sudah terdaftar");
        }
        throw err;
      }
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
      await writeAuditLog({
        actor: admin,
        action: "employee.bulk_delete",
        entityType: "employee",
        meta: { count: ids.length, ids: ids.slice(0, 20), requestId },
      });
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
      await writeAuditLog({
        actor: admin,
        action: "employee.import",
        entityType: "employee",
        meta: {
          created: result.created,
          updated: result.updated,
          errors: result.errors,
          requestId,
        },
      });
      return res.status(200).json(result);
    }

    res.setHeader("Allow", "GET, POST, DELETE, PUT");
    return sendError(res, 405, "Method Not Allowed");
  });
}
