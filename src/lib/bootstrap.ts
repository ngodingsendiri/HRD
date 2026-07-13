/**
 * One-shot app warm-up after login: JS chunks + API data.
 * Goal: first screen waits; later menu clicks are instant (cache hit).
 */
import { api } from "./api.js";
import {
  ALL_EMPLOYEES_LEAN_KEY,
  cacheSet,
  cacheGet,
} from "./queryCache.js";
import { prefetchAllRoutes } from "./routePrefetch.js";
import type { Employee } from "../types.js";

export { ALL_EMPLOYEES_LEAN_KEY };

export type BootstrapProgress = {
  step: number;
  total: number;
  label: string;
};

type ProgressFn = (p: BootstrapProgress) => void;

let bootstrapPromise: Promise<void> | null = null;
let bootstrapped = false;

export function isAppBootstrapped(): boolean {
  return bootstrapped;
}

export function peekAllEmployeesLean(): Employee[] | undefined {
  return cacheGet<Employee[]>(ALL_EMPLOYEES_LEAN_KEY, Number.POSITIVE_INFINITY);
}

/** Load every employee page into GET cache + one consolidated list for Print. */
async function preloadAllEmployeesLean(): Promise<Employee[]> {
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
 * Run once per session after auth. Concurrent callers share the same promise.
 * Safe to call again after cache invalidation (mutations) — set force=true.
 */
export function bootstrapApp(
  onProgress?: ProgressFn,
  opts?: { force?: boolean },
): Promise<void> {
  if (bootstrapped && !opts?.force) return Promise.resolve();
  if (bootstrapPromise && !opts?.force) return bootstrapPromise;

  const total = 5;
  const report = (step: number, label: string) => {
    onProgress?.({ step, total, label });
  };

  bootstrapPromise = (async () => {
    try {
      report(1, "Memuat halaman aplikasi…");
      await prefetchAllRoutes();

      report(2, "Memuat ringkasan…");
      await api.getDashboardStats();

      report(3, "Memuat pengaturan…");
      await Promise.all([
        api.getSettings("all"),
        api.getSettings(["core", "logo", "kamus"]),
        api.getSettings(["peta", "kamus"]),
      ]);

      report(4, "Memuat daftar pegawai…");
      // Default list view (Pegawai page)
      await api.getEmployeesPage({
        limit: 50,
        offset: 0,
        lean: true,
      });

      report(5, "Menyiapkan data cetak…");
      // Full lean roster (Cetak) + fills page caches along the way
      await preloadAllEmployeesLean();

      bootstrapped = true;
      report(5, "Siap");
    } finally {
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

/** Call after mutations that wipe employee/settings caches so next nav stays warm. */
export function rebootstrapInBackground(): void {
  bootstrapped = false;
  // Debounce rapid saves (bulk import etc.)
  window.setTimeout(() => {
    void bootstrapApp(undefined, { force: true }).catch((err) => {
      console.warn("Background re-bootstrap failed:", err);
    });
  }, 400);
}
