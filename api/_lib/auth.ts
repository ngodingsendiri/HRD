/**
 * Backwards-compatible re-export.
 * Prefer importing from `./session.js` in new code.
 */
export {
  requireAdmin,
  requireStaff,
  type StaffUser as AdminUser,
  type StaffUser,
} from "./session.js";
