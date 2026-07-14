/**
 * Background warm-up after login — must NOT block the app shell.
 *
 * Critical path (fast): dashboard stats + one settings payload.
 * Heavy paths (print full roster, all route chunks) load on demand / idle.
 */
import { api } from "./api.js";
import {
  ALL_EMPLOYEES_LEAN_KEY,
  cacheSet,
  cacheGet,
} from "./queryCache.js";
import type { Employee } from "../types.js";

export { ALL_EMPLOYEES_LEAN_KEY };

export type BootstrapProgress = {
  step: number;
  total: number;
  label: string;
};

type ProgressFn = (p: BootstrapProgress) => void;

let warmPromise: Promise<void> | null = null;
let warmed = false;

export function isAppBootstrapped(): boolean {
  return warmed;
}

export function peekAllEmployeesLean(): Employee[] | undefined {
  return cacheGet<Employee[]>(ALL_EMPLOYEES_LEAN_KEY, Number.POSITIVE_INFINITY);
}

/**
 * Full lean roster for Print only — not part of login critical path.
 * Safe to call from Print page; fills page caches along the way.
 */
export async function preloadAllEmployeesLean(): Promise<Employee[]> {
  const cached = peekAllEmployeesLean();
  if (cached) return cached;

  const all: Employee[] = [];
  let offset = 0;
  const pageSize = 500;
  for (let page = 0; page < 50; page++) {
    const res = await api.getEmployeesPage({
      limit: pageSize,
      offset,
      lean: true,
    });
    all.push(...res.data);
    offset += res.data.length;
    if (offset >= res.total || res.data.length === 0) break;
  }
  cacheSet(ALL_EMPLOYEES_LEAN_KEY, all);
  return all;
}

/**
 * Light warm after auth: stats + settings (single include).
 * Does not prefetch all routes or full employee roster.
 */
export function bootstrapApp(
  onProgress?: ProgressFn,
  opts?: { force?: boolean },
): Promise<void> {
  if (warmed && !opts?.force) return Promise.resolve();
  if (warmPromise && !opts?.force) return warmPromise;

  const total = 2;
  const report = (step: number, label: string) => {
    onProgress?.({ step, total, label });
  };

  warmPromise = (async () => {
    try {
      report(1, "Memuat dashboard…");
      await api.getDashboardStats().catch((err) => {
        console.warn("Warm stats failed:", err);
      });

      report(2, "Memuat pengaturan…");
      // One settings payload — pages can request other includes as needed
      await api.getSettings("all").catch((err) => {
        console.warn("Warm settings failed:", err);
      });

      warmed = true;
      report(2, "Siap");
    } finally {
      warmPromise = null;
    }
  })();

  return warmPromise;
}

/**
 * Fire-and-forget after login. UI must not wait on this.
 * Optional: warm first employees page for snappier Pegawai open.
 */
export function warmAppInBackground(): void {
  void bootstrapApp(undefined, { force: false })
    .then(() =>
      api
        .getEmployeesPage({ limit: 50, offset: 0, lean: true })
        .catch(() => undefined),
    )
    .catch((err) => {
      console.warn("Background warm failed:", err);
    });
}

/**
 * After mutations: caches already invalidated by api.ts.
 * Soft re-fetch stats only (not full roster / all routes).
 */
export function rebootstrapInBackground(): void {
  window.setTimeout(() => {
    // force:1 busts client + server stats cache after mutations
    void api
      .getDashboardStats({ force: true })
      .then(() => {
        warmed = true;
      })
      .catch((err) => {
        console.warn("Background stats revalidate failed:", err);
      });
  }, 400);
}
