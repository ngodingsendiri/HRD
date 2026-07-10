import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getEmployee,
  updateEmployee,
  deleteEmployee,
  findEmployeeIdByNipOrNik,
} from "../../src/lib/queries.js";
import { EmployeeSchema } from "../../src/lib/schemas.js";
import { requireAdmin } from "../_lib/auth.js";
import { sendError, withErrorBoundary } from "../_lib/http.js";

/**
 * GET    /api/employees/:id  → get one
 * PUT    /api/employees/:id  → update
 * DELETE /api/employees/:id  → delete one
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return withErrorBoundary(res, "employees/[id]", async () => {
    try {
      await requireAdmin(req, res);
    } catch {
      return;
    }

    const { id } = req.query as { id: string };
    if (!id || typeof id !== "string") {
      return sendError(res, 400, "id required");
    }

    if (req.method === "GET") {
      const emp = await getEmployee(id);
      if (!emp) return sendError(res, 404, "Not found");
      return res.status(200).json(emp);
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
        return res.status(200).json(updated);
      } catch {
        return sendError(res, 404, "Not found");
      }
    }

    if (req.method === "DELETE") {
      try {
        await deleteEmployee(id);
        return res.status(204).end();
      } catch {
        return sendError(res, 404, "Not found");
      }
    }

    res.setHeader("Allow", "GET, PUT, DELETE");
    return sendError(res, 405, "Method Not Allowed");
  });
}
