/**
 * Backwards-compatible re-export of the auth guard.
 *
 * Data handlers (api/employees.ts, api/settings.ts, …) import
 * `requireAdmin` from "./_lib/auth.js". The real implementation now lives in
 * session.ts; this file keeps the old import path working so those handlers
 * require zero changes.
 */
export { requireAdmin, type AdminUser } from "./session.js";
