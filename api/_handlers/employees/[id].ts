import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getEmployee,
  updateEmployee,
  deleteEmployee,
  findEmployeeIdByNipOrNik,
} from "../../../src/lib/queries.js";
import { EmployeeSchema } from "../../../src/lib/schemas.js";
import { requireAdmin, requireStaff } from "../../_lib/session.js";
import { writeAuditLog } from "../../../src/lib/audit.js";
import { pathParamId } from "../../_lib/apiKey.js";
import { ensureRequestId, sendError, withErrorBoundary } from "../../_lib/http.js";

function isPrismaNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2025"
  );
}

function isPrismaUnique(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

/**
 * GET    /api/employees/:id  → get one
 * PUT    /api/employees/:id  → update
 * DELETE /api/employees/:id  → delete one
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = ensureRequestId(req, res);

  return withErrorBoundary(res, "employees/[id]", async () => {
    const id = pathParamId(req.query.id as string | string[] | undefined);
    if (!id) {
      return sendError(res, 400, "id required");
    }

    if (req.method === "GET") {
      try {
        await requireStaff(req, res);
      } catch {
        return;
      }
      const emp = await getEmployee(id);
      if (!emp) return sendError(res, 404, "Not found");
      return res.status(200).json(emp);
    }

    let admin;
    try {
      admin = await requireAdmin(req, res);
    } catch {
      return;
    }

    if (req.method === "PUT") {
      const parsed = EmployeeSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, 400, "Data pegawai tidak valid", {
          details: parsed.error.flatten(),
        });
      }

      const nip = parsed.data.nip;
      const nik = parsed.data.nik;
      if (nip || nik) {
        const dup = await findEmployeeIdByNipOrNik(nip, nik, id);
        if (dup) {
          return sendError(res, 409, "NIP atau NIK sudah terdaftar pada pegawai lain");
        }
      }

      try {
        const updated = await updateEmployee(id, parsed.data);
        await writeAuditLog({
          actor: admin,
          action: "employee.update",
          entityType: "employee",
          entityId: id,
          meta: { fields: Object.keys(parsed.data), requestId },
        });
        return res.status(200).json(updated);
      } catch (err) {
        if (isPrismaNotFound(err)) return sendError(res, 404, "Not found");
        if (isPrismaUnique(err)) {
          return sendError(res, 409, "NIP atau NIK sudah terdaftar pada pegawai lain");
        }
        throw err;
      }
    }

    if (req.method === "DELETE") {
      try {
        await deleteEmployee(id);
        await writeAuditLog({
          actor: admin,
          action: "employee.delete",
          entityType: "employee",
          entityId: id,
          meta: { requestId },
        });
        return res.status(204).end();
      } catch (err) {
        if (isPrismaNotFound(err)) return sendError(res, 404, "Not found");
        throw err;
      }
    }

    res.setHeader("Allow", "GET, PUT, DELETE");
    return sendError(res, 405, "Method Not Allowed");
  });
}
