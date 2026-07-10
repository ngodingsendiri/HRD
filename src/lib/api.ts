/**
 * Browser-side API client — single gateway to /api/*.
 * Never import Prisma from the client bundle.
 */
import type { Employee, AppSettings } from "../types";
import type { DashboardStats } from "./dashboardStats";

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

export type EmployeesPage = {
  data: Employee[];
  total: number;
  limit: number;
  offset: number;
};

export type BulkImportError = {
  row: number;
  nip?: string;
  nik?: string;
  nama?: string;
  message: string;
};

export type BulkUpsertResult = {
  created: number;
  updated: number;
  errors: number;
  errorDetails?: BulkImportError[];
};

export type SettingsInclude = "core" | "logo" | "kamus" | "peta" | "all";

export type ApiKeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  allowedOrigins: string[];
  createdBy: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type EmployeeListParams = {
  q?: string;
  limit?: number;
  offset?: number;
  lean?: boolean;
  status?: string;
  alert?: "kp" | "kgb" | "any";
};

function employeesQuery(params?: EmployeeListParams): string {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  if (params?.lean === false) sp.set("lean", "0");
  else if (params?.lean) sp.set("lean", "1");
  if (params?.status && params.status !== "all") sp.set("status", params.status);
  if (params?.alert) sp.set("alert", params.alert);
  const qs = sp.toString();
  return qs ? `/api/employees?${qs}` : "/api/employees";
}

export const api = {
  async getEmployeesPage(params?: EmployeeListParams): Promise<EmployeesPage> {
    return request<EmployeesPage>(employeesQuery(params));
  },

  /** Convenience wrapper — prefer getEmployeesPage for pagination UI. */
  async getEmployees(params?: EmployeeListParams): Promise<Employee[]> {
    const page = await this.getEmployeesPage({
      limit: 50,
      offset: 0,
      lean: true,
      ...params,
    });
    return page.data;
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

  async bulkUpsert(employees: Record<string, unknown>[]): Promise<BulkUpsertResult> {
    return request<BulkUpsertResult>("/api/employees", {
      method: "PUT",
      body: JSON.stringify({ action: "bulk-upsert", employees }),
    });
  },

  async getSettings(
    include: SettingsInclude[] | string = "all",
  ): Promise<AppSettings> {
    const q = Array.isArray(include) ? include.join(",") : include;
    return request<AppSettings>(`/api/settings?include=${encodeURIComponent(q)}`);
  },

  async upsertSettings(settings: AppSettings): Promise<AppSettings> {
    return request<AppSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  async getDashboardStats(): Promise<DashboardStats> {
    return request<DashboardStats>("/api/stats");
  },

  async getSession(): Promise<{
    user: {
      email: string;
      name?: string;
      image?: string;
      role?: string;
      canWrite?: boolean;
    } | null;
  }> {
    return request("/api/auth/me");
  },

  // ── External API keys (session admin only) ───────────────────────────────

  async listApiKeys(includeRevoked = false): Promise<{
    keys: ApiKeyRecord[];
    scopes: string[];
  }> {
    const q = includeRevoked ? "?includeRevoked=1" : "";
    return request(`/api/v1/keys${q}`);
  },

  async createApiKey(input: {
    name: string;
    scopes?: string[];
    allowedOrigins?: string[];
    expiresInDays?: number | null;
  }): Promise<{
    key: string;
    record: ApiKeyRecord;
    warning?: string;
  }> {
    return request("/api/v1/keys", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async revokeApiKey(id: string): Promise<{ ok: boolean; record: ApiKeyRecord }> {
    return request(`/api/v1/keys/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};
