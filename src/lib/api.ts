/**
 * Browser-side API client — single gateway to /api/*.
 * Never import Prisma from the client bundle.
 */
import type { Employee, AppSettings } from "../types.js";
import type { DashboardStats } from "./dashboardStats.js";
import {
  ALL_EMPLOYEES_LEAN_KEY,
  cacheGet,
  cacheGetOrFetch,
  cacheInvalidate,
  DEFAULT_TTL_MS,
} from "./queryCache.js";

/** Typed API failure — preserves HTTP status for callers. */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    // Always send session cookie for same-origin /api/* (constitution: auth via cookie)
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message =
      (err as { error?: string }).error || `Request failed: ${res.status}`;
    throw new ApiError(message, res.status);
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

export type BulkImportWarning = {
  row: number;
  nip?: string;
  nama?: string;
  message: string;
};

export type BulkUpsertResult = {
  created: number;
  updated: number;
  errors: number;
  errorDetails?: BulkImportError[];
  warnings?: BulkImportWarning[];
  dryRun?: boolean;
  mode?: "patch" | "replace";
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
  bidang?: string;
};

function employeesQuery(params?: EmployeeListParams): string {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.limit != null) sp.set("limit", String(params.limit));
  if (params?.offset != null) sp.set("offset", String(params.offset));
  if (params?.lean === false) sp.set("lean", "0");
  else if (params?.lean) sp.set("lean", "1");
  if (params?.status && params.status !== "all") sp.set("status", params.status);
  if (params?.bidang && params.bidang !== "all") sp.set("bidang", params.bidang);
  const qs = sp.toString();
  return qs ? `/api/employees?${qs}` : "/api/employees";
}

function invalidateEmployeeReads() {
  cacheInvalidate("employees:");
  cacheInvalidate("employee:");
  cacheInvalidate("stats");
  cacheInvalidate(ALL_EMPLOYEES_LEAN_KEY);
  // Re-warm in background so menus stay instant after edits
  void import("./bootstrap.js").then((m) => m.rebootstrapInBackground());
}

export const api = {
  /** Sync peek — for skipping full-page skeleton when cache is warm. */
  peekEmployeesPage(params?: EmployeeListParams): EmployeesPage | undefined {
    return cacheGet<EmployeesPage>(`employees:${employeesQuery(params)}`);
  },
  peekSettings(
    include: SettingsInclude[] | string = "all",
  ): AppSettings | undefined {
    const q = Array.isArray(include) ? include.join(",") : include;
    return cacheGet<AppSettings>(`settings:${q}`);
  },
  peekDashboardStats(): DashboardStats | undefined {
    return cacheGet<DashboardStats>("stats");
  },

  async getEmployeesPage(params?: EmployeeListParams): Promise<EmployeesPage> {
    const key = `employees:${employeesQuery(params)}`;
    return cacheGetOrFetch(key, () => request<EmployeesPage>(employeesQuery(params)));
  },

  async getEmployeeBidangOptions(): Promise<string[]> {
    return cacheGetOrFetch("employees:bidang-options", async () => {
      const res = await request<{ bidang: string[] }>(
        "/api/employees?facets=bidang&limit=1",
      );
      return res.bidang ?? [];
    });
  },

  async getEmployee(id: string): Promise<Employee | null> {
    const key = `employee:${id}`;
    return cacheGetOrFetch(key, async () => {
      try {
        return await request<Employee>(
          `/api/employees/${encodeURIComponent(id)}`,
        );
      } catch (e) {
        // Contract: missing row → null (not throw), so UI can show "tidak ditemukan"
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    });
  },

  async createEmployee(emp: Employee): Promise<Employee> {
    const created = await request<Employee>("/api/employees", {
      method: "POST",
      body: JSON.stringify(emp),
    });
    invalidateEmployeeReads();
    return created;
  },

  async updateEmployee(id: string, emp: Partial<Employee>): Promise<Employee> {
    const updated = await request<Employee>(`/api/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(emp),
    });
    invalidateEmployeeReads();
    return updated;
  },

  async deleteEmployee(id: string): Promise<void> {
    await request<void>(`/api/employees/${id}`, { method: "DELETE" });
    invalidateEmployeeReads();
  },

  async deleteEmployees(ids: string[]): Promise<void> {
    await request<void>("/api/employees", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    invalidateEmployeeReads();
  },

  async bulkUpsert(
    employees: Record<string, unknown>[],
    opts?: { mode?: "patch" | "replace"; dryRun?: boolean },
  ): Promise<BulkUpsertResult> {
    const result = await request<BulkUpsertResult>("/api/employees", {
      method: "PUT",
      body: JSON.stringify({
        action: "bulk-upsert",
        employees,
        mode: opts?.mode ?? "patch",
        dryRun: Boolean(opts?.dryRun),
      }),
    });
    if (!opts?.dryRun) invalidateEmployeeReads();
    return result;
  },

  async getSettings(
    include: SettingsInclude[] | string = "all",
  ): Promise<AppSettings> {
    const q = Array.isArray(include) ? include.join(",") : include;
    const key = `settings:${q}`;
    return cacheGetOrFetch(
      key,
      () =>
        request<AppSettings>(
          `/api/settings?include=${encodeURIComponent(q)}`,
        ),
      // Settings rarely change during a session
      DEFAULT_TTL_MS * 2,
    );
  },

  async upsertSettings(settings: AppSettings): Promise<AppSettings> {
    const saved = await request<AppSettings>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    cacheInvalidate("settings:");
    void import("./bootstrap.js").then((m) => m.rebootstrapInBackground());
    return saved;
  },

  async getDashboardStats(opts?: { force?: boolean }): Promise<DashboardStats> {
    if (opts?.force) cacheInvalidate("stats");
    // Cache-bust query so browser/server warm path can skip stale stats
    const url = opts?.force
      ? `/api/stats?force=1&_=${Date.now()}`
      : "/api/stats";
    return cacheGetOrFetch(
      "stats",
      () => request<DashboardStats>(url),
      DEFAULT_TTL_MS,
    );
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
