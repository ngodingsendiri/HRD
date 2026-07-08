/**
 * Browser-side API client. All data access from React components goes through
 * these helpers, which call the /api serverless functions (where Prisma runs).
 *
 * Prisma/queries.ts must NEVER be imported from src/ (client bundle) — only
 * from /api/* serverless functions. This file is the client's single gateway.
 */
import type { Employee, AppSettings } from "../types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `Request failed: ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// ============ Employees ============

export const api = {
  async getEmployees(): Promise<Employee[]> {
    return request<Employee[]>("/api/employees");
  },

  async getEmployee(id: string): Promise<Employee | null> {
    return request<Employee | null>(`/api/employees/${id}`);
  },

  async createEmployee(emp: Employee): Promise<Employee> {
    return request<Employee>("/api/employees", {
      method: "POST",
      body: JSON.stringify(emp),
    });
  },

  async updateEmployee(id: string, emp: Partial<Employee>): Promise<Employee> {
    return request<Employee>(`/api/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(emp),
    });
  },

  async deleteEmployee(id: string): Promise<void> {
    await request<void>(`/api/employees/${id}`, { method: "DELETE" });
  },

  async deleteEmployees(ids: string[]): Promise<void> {
    await request<void>("/api/employees", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
  },

  async bulkUpsert(employees: Record<string, unknown>[]): Promise<{
    created: number;
    updated: number;
    errors: number;
  }> {
    return request("/api/employees", {
      method: "PUT",
      body: JSON.stringify({ action: "bulk-upsert", employees }),
    });
  },

  // ============ Settings ============

  async getSettings(): Promise<AppSettings> {
    return request<AppSettings>("/api/settings");
  },

  async upsertSettings(settings: AppSettings): Promise<AppSettings> {
    return request<AppSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  // ============ Auth ============

  async getSession(): Promise<{ user: { email: string; name?: string; image?: string } | null }> {
    return request("/api/auth/me");
  },
};
