import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getEmployee, updateEmployee, deleteEmployee } from "../../src/lib/queries";
import { EmployeeSchema } from "../../src/lib/schemas";
import { requireAdmin } from "../_lib/auth";

/**
 * GET    /api/employees/:id  → get one
 * PUT    /api/employees/:id  → update
 * DELETE /api/employees/:id  → delete one
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireAdmin(req, res);
  } catch {
    return;
  }

  const { id } = req.query as { id: string };

  if (req.method === "GET") {
    const emp = await getEmployee(id);
    if (!emp) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(emp);
  }

  if (req.method === "PUT") {
    const parsed = EmployeeSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid employee data", details: parsed.error.flatten() });
    }
    const updated = await updateEmployee(id, parsed.data);
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    await deleteEmployee(id);
    return res.status(204).end();
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ error: "Method Not Allowed" });
}
