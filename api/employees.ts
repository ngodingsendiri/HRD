import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  deleteEmployees,
  bulkUpsertEmployees,
} from "../src/lib/queries.js";
import { EmployeeSchema } from "../src/lib/schemas.js";
import { requireAdmin } from "./_lib/auth.js";

/**
 * GET    /api/employees         → list all
 * POST   /api/employees         → create
 * DELETE /api/employees         → bulk delete { ids: string[] }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAdmin(req, res);
  } catch {
    return; // requireAdmin already sent 401
  }

  if (req.method === "GET") {
    const rows = await getEmployees();
    return res.status(200).json(rows);
  }

  if (req.method === "POST") {
    const parsed = EmployeeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid employee data", details: parsed.error.flatten() });
    }
    const created = await createEmployee(parsed.data);
    return res.status(201).json(created);
  }

  if (req.method === "DELETE") {
    const ids = (req.body?.ids ?? []) as string[];
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array required" });
    }
    await deleteEmployees(ids);
    return res.status(204).end();
  }

  if (req.method === "PUT" && req.body?.action === "bulk-upsert") {
    // Bulk import from Excel. Matches existing rows by nip/nik, else creates.
    const incoming = (req.body.employees ?? []) as Record<string, unknown>[];
    if (!Array.isArray(incoming)) {
      return res.status(400).json({ error: "employees array required" });
    }
    const result = await bulkUpsertEmployees(incoming as never);
    return res.status(200).json(result);
  }

  res.setHeader("Allow", "GET, POST, DELETE, PUT");
  return res.status(405).json({ error: "Method Not Allowed" });
}
