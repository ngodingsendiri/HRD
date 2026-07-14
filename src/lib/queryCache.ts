/**
 * Tiny in-memory GET cache so navigating between menus does not
 * re-download the same JSON every time (session TTL, not localStorage).
 */

/** Consolidated lean roster for Print (filled when Cetak opens, not at login). */
export const ALL_EMPLOYEES_LEAN_KEY = "employees:all-lean";

type Entry = { at: number; data: unknown; inflight?: Promise<unknown> };

const store = new Map<string, Entry>();

/**
 * Bumped on every invalidate. In-flight fetchers capture the generation at
 * start and only cacheSet if it still matches — prevents stale GETs from
 * re-seeding the cache after a mutation.
 */
let generation = 0;

/**
 * Session-length cache: data stays warm until mutation invalidates it.
 * (Previously 45s — caused loading again when hopping menus.)
 */
export const DEFAULT_TTL_MS = 1000 * 60 * 60; // 1 hour

export function cacheGet<T>(key: string, ttlMs = DEFAULT_TTL_MS): T | undefined {
  const e = store.get(key);
  if (!e || e.inflight || e.at === 0) return undefined;
  if (Date.now() - e.at > ttlMs) {
    store.delete(key);
    return undefined;
  }
  return e.data as T;
}

export function cacheSet(key: string, data: unknown): void {
  store.set(key, { at: Date.now(), data });
}

/** Dedup concurrent identical GETs (e.g. double mount Strict Mode). */
export async function cacheGetOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = cacheGet<T>(key, ttlMs);
  if (hit !== undefined) return hit;

  const existing = store.get(key);
  if (existing?.inflight) return existing.inflight as Promise<T>;

  const genAtStart = generation;

  const inflight = fetcher()
    .then((data) => {
      // Mutation happened while we were in flight — do not re-seed stale data
      if (genAtStart !== generation) {
        const e = store.get(key);
        // Only clear OUR placeholder — never wipe a newer inflight/fresh entry
        if (e?.inflight === inflight) store.delete(key);
        return data;
      }
      cacheSet(key, data);
      const e = store.get(key);
      if (e) delete e.inflight;
      return data;
    })
    .catch((err) => {
      const e = store.get(key);
      if (e?.inflight === inflight) store.delete(key);
      throw err;
    });

  store.set(key, { at: 0, data: undefined, inflight });
  return inflight;
}

/** Drop cache entries. No prefix → clear all. Always bumps generation once. */
export function cacheInvalidate(prefix?: string): void {
  generation += 1;
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

/** Invalidate several prefixes with a single generation bump. */
export function cacheInvalidateMany(prefixes: string[]): void {
  generation += 1;
  for (const prefix of prefixes) {
    for (const k of store.keys()) {
      if (k.startsWith(prefix)) store.delete(k);
    }
  }
}

/** Test helper — current generation (not for UI). */
export function cacheGeneration(): number {
  return generation;
}
